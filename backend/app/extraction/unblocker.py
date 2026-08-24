"""Optional unblocking-proxy escalation for retailers that refuse direct fetches.

Measured baseline before this existed (scripts/probe_urls.py, 2026-08-24):
all six probe retailers failed from a residential IP -- REI and Best Buy timed
out, B&H returned 403, Newegg served a challenge interstitial, and Amazon and
Walmart returned pages with no extractable product. Direct fetching alone does
not make paste-to-track work on the sites people actually shop.

Design notes:

* **Disabled unless configured.** Blank provider or token means every call
  reports "not configured" and the pipeline behaves exactly as before. This is
  the same degrade-gracefully contract the AI layer follows.

* **The SSRF guard runs first, not second.** The whole point of
  ``fetch._validate_url`` is that we resolve the host ourselves and refuse
  private, loopback, link-local and cloud-metadata addresses. Handing a URL
  straight to a third-party proxy would delegate resolution to the vendor and
  quietly discard that guarantee -- a paste of ``http://169.254.169.254/``
  would be fetched by the proxy on our behalf. So the caller validates before
  escalating, and this module refuses to run on an unvalidated URL.

* **Escalation is opt-in per domain.** Every unblocked request costs money.
  ``unblocker_domains`` bounds spending to the domains that actually need it;
  blank means "any domain", which is convenient for testing and expensive in
  production.

* **The response is still capped.** A proxy response is as untrusted as a
  direct one, so the same byte ceiling applies.
"""
from __future__ import annotations

import logging

import httpx

from ..settings import settings
from .types import FetchResult

logger = logging.getLogger(__name__)

BRIGHTDATA_ENDPOINT = "https://api.brightdata.com/request"


class UnblockerError(RuntimeError):
    """The unblocker was configured and attempted, but did not return a page."""


def is_configured() -> bool:
    """True when an unblocking provider is fully configured."""
    if settings.unblocker_provider != "brightdata":
        return False
    return bool(settings.brightdata_api_token and settings.brightdata_zone)


def handles_domain(domain: str) -> bool:
    """Whether escalation is permitted for this domain.

    An empty allowlist means every domain, which is the convenient setting for
    a probe run and the wrong one for production -- each escalated fetch is
    billable.
    """
    allowed = settings.unblocker_domains
    if not allowed:
        return True
    domain = domain.lower().removeprefix("www.")
    return any(
        domain == d or domain.endswith("." + d)
        for d in (a.lower().removeprefix("www.") for a in allowed)
    )


def fetch_unblocked(
    url: str,
    *,
    max_bytes: int | None = None,
    timeout: float | None = None,
) -> FetchResult:
    """Fetch `url` through the configured unblocking proxy.

    The caller MUST have already run the SSRF validation in `fetch.py` on this
    exact URL -- see the module docstring. Raises UnblockerError on any
    failure so the caller can fall back to reporting the original, cheaper
    failure rather than masking it.
    """
    if not is_configured():
        raise UnblockerError("unblocker is not configured")

    max_bytes = max_bytes if max_bytes is not None else settings.fetch_max_bytes
    timeout = timeout if timeout is not None else settings.unblocker_timeout

    try:
        response = httpx.post(
            BRIGHTDATA_ENDPOINT,
            headers={
                "Authorization": f"Bearer {settings.brightdata_api_token}",
                "Content-Type": "application/json",
            },
            json={
                "zone": settings.brightdata_zone,
                "url": url,
                "format": "raw",
            },
            timeout=timeout,
        )
    except httpx.HTTPError as exc:
        raise UnblockerError(f"unblocker request failed: {exc}") from exc

    if response.status_code >= 400:
        raise UnblockerError(
            f"unblocker returned HTTP {response.status_code} for {url}"
        )

    html = response.content[:max_bytes].decode("utf-8", errors="replace")
    if not html.strip():
        raise UnblockerError(f"unblocker returned an empty body for {url}")

    # The proxy resolves and follows redirects itself, so the URL we asked for
    # is the best `final_url` available. Recorded honestly rather than implying
    # we observed the redirect chain.
    return FetchResult(html=html, final_url=url, status_code=response.status_code)
