"""SSRF-guarded HTTP fetch for user-supplied product URLs.

This is the security-critical surface of the whole pivot: users paste
arbitrary URLs that we fetch *server-side*. Without guarding this, a user
could point us at http://169.254.169.254/ (cloud metadata), an internal
admin panel, or anything else reachable from the worker's network.

Known residual: `_validate_host` resolves and checks the hostname at
validation time, not at TCP-connect time, so a DNS answer that changes
between validation and the actual socket connect (DNS rebinding) is not
defended against here. For this project's threat model — a rate-limited
fetch triggered once per product per day by an authenticated user, not a
public unauthenticated endpoint — validating on every hop (including every
redirect) is a defensible tradeoff. A fully hardened version would pin the
validated IP and connect directly to it with the correct SNI/Host header,
which requires a custom httpx transport.
"""
from __future__ import annotations

import ipaddress
import logging
import socket

import httpx

from ..settings import settings
from . import unblocker
from .types import FetchResult

_ALLOWED_SCHEMES = {"http", "https"}
_ALLOWED_PORTS = {None, 80, 443}
_MAX_REDIRECTS = 3

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": settings.scraper_user_agent,
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


class SsrfBlockedError(ValueError):
    """A URL (or one of its redirect hops) resolves to a non-public address,
    or uses a scheme/port outside the allowlist."""


class FetchError(RuntimeError):
    """Fetch failed for a non-SSRF reason: timeout, HTTP error, non-HTML
    content, or an unresolvable redirect chain. `status_code` is set when
    the failure was an HTTP error response, so callers can distinguish a
    bot-wall (403/429) from a generic failure."""

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


def _validate_host(host: str) -> None:
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise SsrfBlockedError(f"could not resolve host: {host}") from exc

    for _family, _type, _proto, _canonname, sockaddr in infos:
        ip = ipaddress.ip_address(sockaddr[0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise SsrfBlockedError(
                f"host {host!r} resolves to a non-public address: {ip}"
            )


def _validate_url(url: str) -> httpx.URL:
    parsed = httpx.URL(url)
    if parsed.scheme not in _ALLOWED_SCHEMES:
        raise SsrfBlockedError(f"unsupported scheme: {parsed.scheme!r}")
    if parsed.port not in _ALLOWED_PORTS:
        raise SsrfBlockedError(f"unsupported port: {parsed.port!r}")
    if not parsed.host:
        raise SsrfBlockedError("URL has no host")
    _validate_host(parsed.host)
    return parsed


def _fetch_one_hop(
    client: httpx.Client, url: str, max_bytes: int
) -> tuple[int, httpx.Headers, bytes]:
    with client.stream("GET", url) as response:
        status = response.status_code
        headers = response.headers

        if 300 <= status < 400:
            response.read()  # drain the (small) redirect body
            return status, headers, b""

        raw = bytearray()
        for chunk in response.iter_bytes():
            remaining = max_bytes - len(raw)
            if remaining <= 0:
                break
            # Truncate within the chunk itself — a single chunk (especially
            # from small/mocked responses) can exceed max_bytes on its own,
            # so capping only between chunks isn't enough.
            raw.extend(chunk[:remaining])
            if len(raw) >= max_bytes:
                break
        return status, headers, bytes(raw)


def _escalate(url: str, host: str, max_bytes: int, reason: str) -> FetchResult | None:
    """Retry a refused fetch through the unblocking proxy, or None if that is
    not available for this URL.

    Only ever called after `_validate_url` has passed for this exact URL --
    the SSRF guard must run before anything is handed to a third-party proxy,
    or we would be delegating host resolution to the vendor and losing the
    protection entirely.
    """
    if not unblocker.is_configured() or not unblocker.handles_domain(host):
        return None
    try:
        result = unblocker.fetch_unblocked(url, max_bytes=max_bytes)
    except unblocker.UnblockerError as exc:
        # Report the original, cheaper failure rather than masking it behind a
        # proxy error the user can do nothing about.
        logger.warning("unblocker escalation failed for %s: %s", url, exc)
        return None
    logger.info("unblocked %s after %s", url, reason)
    return result


def safe_fetch(
    url: str,
    *,
    max_bytes: int | None = None,
    timeout: float | None = None,
    transport: httpx.BaseTransport | None = None,
    allow_unblocker: bool = True,
) -> FetchResult:
    """Fetch `url`, following redirects manually so every hop is
    re-validated (blocks 'public URL -> 302 -> http://169.254.169.254'
    laundering). Response body is streamed with a hard byte cap.

    When the site refuses us outright -- 403/429, or a timeout, which is how
    several retailers express refusal rather than answering -- and an
    unblocking proxy is configured for that domain, the fetch is retried
    through it once. Set `allow_unblocker=False` to force the direct path.

    `transport` is exposed only for tests (inject `httpx.MockTransport` to
    simulate redirect chains without real network access); production
    callers should never pass it.
    """
    max_bytes = max_bytes if max_bytes is not None else settings.fetch_max_bytes
    timeout = timeout if timeout is not None else settings.fetch_timeout

    current_url = url
    with httpx.Client(
        headers=HEADERS, timeout=timeout, follow_redirects=False, transport=transport
    ) as client:
        for _hop in range(_MAX_REDIRECTS + 1):
            parsed = _validate_url(current_url)
            try:
                status, headers, raw = _fetch_one_hop(client, current_url, max_bytes)
            except httpx.TimeoutException:
                # Several large retailers simply never answer a plain client
                # rather than returning a status. Measured: REI and Best Buy
                # both read-timed-out at 15s on a direct fetch.
                if allow_unblocker:
                    escalated = _escalate(
                        current_url, parsed.host, max_bytes, "timeout"
                    )
                    if escalated is not None:
                        return escalated
                raise

            if 300 <= status < 400:
                location = headers.get("location")
                if not location:
                    raise FetchError(
                        f"redirect from {current_url} carried no Location header"
                    )
                current_url = str(parsed.join(location))
                continue

            if status >= 400:
                # 403/429 is how a bot defense usually answers. Everything
                # else (404, 500) is a real error the proxy cannot fix, so we
                # do not pay to retry it.
                if allow_unblocker and status in (403, 429):
                    escalated = _escalate(
                        current_url, parsed.host, max_bytes, f"HTTP {status}"
                    )
                    if escalated is not None:
                        return escalated
                raise FetchError(
                    f"HTTP {status} fetching {current_url}", status_code=status
                )

            content_type = headers.get("content-type", "")
            if content_type and "html" not in content_type:
                raise FetchError(
                    f"unexpected content-type {content_type!r} for {current_url}"
                )

            html = raw.decode("utf-8", errors="replace")
            return FetchResult(html=html, final_url=current_url, status_code=status)

        raise FetchError(f"too many redirects (> {_MAX_REDIRECTS}) starting from {url}")
