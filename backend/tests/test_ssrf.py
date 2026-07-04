"""SSRF guard tests for the product-URL fetch — the highest-risk surface in
the pivot, since users supply arbitrary URLs fetched server-side.

Host-validation cases use literal IP addresses, which `socket.getaddrinfo`
resolves locally without any real DNS/network call. Redirect-chain cases use
`httpx.MockTransport` so no real HTTP request is made either.
"""
import socket

import httpx
import pytest

from app.extraction.fetch import (
    FetchError,
    SsrfBlockedError,
    _validate_host,
    _validate_url,
    safe_fetch,
)


# ── host validation matrix ───────────────────────────────────────────────

@pytest.mark.parametrize(
    "ip",
    [
        "127.0.0.1",       # loopback
        "10.0.0.5",        # private (RFC1918)
        "172.16.0.1",      # private (RFC1918)
        "192.168.1.1",     # private (RFC1918)
        "169.254.169.254", # link-local — cloud metadata endpoint
        "::1",             # loopback (v6)
        "fc00::1",         # unique local (v6 private)
        "0.0.0.0",         # unspecified
        "224.0.0.1",       # multicast
    ],
)
def test_validate_host_blocks_non_public_addresses(ip):
    with pytest.raises(SsrfBlockedError):
        _validate_host(ip)


@pytest.mark.parametrize("ip", ["8.8.8.8", "1.1.1.1", "93.184.215.14"])
def test_validate_host_allows_public_addresses(ip):
    _validate_host(ip)  # must not raise


def test_validate_host_unresolvable_raises(monkeypatch):
    def fake_getaddrinfo(*_args, **_kwargs):
        raise socket.gaierror("name or service not known")

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
    with pytest.raises(SsrfBlockedError):
        _validate_host("definitely-not-a-real-host.invalid")


# ── scheme / port allowlist ───────────────────────────────────────────────

@pytest.mark.parametrize("url", [
    "ftp://8.8.8.8/file",
    "javascript:alert(1)",
    "file:///etc/passwd",
])
def test_validate_url_rejects_disallowed_schemes(url):
    with pytest.raises(SsrfBlockedError):
        _validate_url(url)


def test_validate_url_rejects_nonstandard_port():
    with pytest.raises(SsrfBlockedError):
        _validate_url("http://8.8.8.8:8080/path")


def test_validate_url_allows_standard_ports():
    _validate_url("https://8.8.8.8:443/path")
    _validate_url("http://8.8.8.8:80/path")
    _validate_url("http://8.8.8.8/path")


# ── redirect-hop re-validation ────────────────────────────────────────────

def test_redirect_to_private_ip_is_blocked():
    def handler(request: httpx.Request) -> httpx.Response:
        if str(request.url) == "http://8.8.8.8/start":
            return httpx.Response(302, headers={"location": "http://169.254.169.254/secret"})
        return httpx.Response(200, headers={"content-type": "text/html"}, content=b"<html>reached private host</html>")

    with pytest.raises(SsrfBlockedError):
        safe_fetch("http://8.8.8.8/start", transport=httpx.MockTransport(handler))


def test_redirect_chain_between_public_hosts_succeeds():
    def handler(request: httpx.Request) -> httpx.Response:
        if str(request.url) == "http://8.8.8.8/start":
            return httpx.Response(302, headers={"location": "http://1.1.1.1/final"})
        return httpx.Response(200, headers={"content-type": "text/html"}, content=b"<html>ok</html>")

    result = safe_fetch("http://8.8.8.8/start", transport=httpx.MockTransport(handler))
    assert result.final_url == "http://1.1.1.1/final"
    assert "ok" in result.html


def test_too_many_redirects_raises_fetch_error():
    def handler(request: httpx.Request) -> httpx.Response:
        # every hop redirects to the next, forever
        n = int(request.url.path.lstrip("/") or 0)
        return httpx.Response(302, headers={"location": f"http://8.8.8.8/{n + 1}"})

    with pytest.raises(FetchError):
        safe_fetch("http://8.8.8.8/0", transport=httpx.MockTransport(handler))


def test_redirect_without_location_header_raises_fetch_error():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302)  # no Location header

    with pytest.raises(FetchError):
        safe_fetch("http://8.8.8.8/start", transport=httpx.MockTransport(handler))


# ── content-type + size cap ───────────────────────────────────────────────

def test_non_html_content_type_rejected():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, headers={"content-type": "application/json"}, content=b"{}")

    with pytest.raises(FetchError):
        safe_fetch("http://8.8.8.8/data.json", transport=httpx.MockTransport(handler))


def test_missing_content_type_is_tolerated():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"<html>no content-type header</html>")

    result = safe_fetch("http://8.8.8.8/page", transport=httpx.MockTransport(handler))
    assert "no content-type header" in result.html


def test_http_error_status_raises_fetch_error_with_status_code():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, headers={"content-type": "text/html"}, content=b"not found")

    with pytest.raises(FetchError) as exc_info:
        safe_fetch("http://8.8.8.8/missing", transport=httpx.MockTransport(handler))
    assert exc_info.value.status_code == 404


def test_response_body_truncated_at_max_bytes():
    big_body = b"<html>" + b"x" * 10_000 + b"</html>"

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, headers={"content-type": "text/html"}, content=big_body)

    result = safe_fetch(
        "http://8.8.8.8/big",
        transport=httpx.MockTransport(handler),
        max_bytes=100,
    )
    assert len(result.html) < len(big_body)
