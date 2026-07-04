"""Unit tests for URL normalization — product identity depends on this being
correct: two URLs differing only in tracking params, casing, or trailing
slash must normalize to the same string (and therefore the same url_hash)."""

import pytest

from app.urlnorm import InvalidUrlError, domain_of, normalize_url, url_hash


def test_strips_utm_params():
    a = normalize_url("https://shop.example.com/p/widget?utm_source=fb&utm_campaign=x")
    b = normalize_url("https://shop.example.com/p/widget")
    assert a == b


def test_strips_known_tracking_params_but_keeps_identity_params():
    a = normalize_url("https://shop.example.com/p?id=B0ABC123&gclid=abc&fbclid=xyz")
    b = normalize_url("https://shop.example.com/p?id=B0ABC123")
    assert a == b


def test_sorts_remaining_query_params_deterministically():
    a = normalize_url("https://shop.example.com/p?b=2&a=1")
    b = normalize_url("https://shop.example.com/p?a=1&b=2")
    assert a == b


def test_lowercases_scheme_and_host():
    a = normalize_url("HTTPS://Shop.Example.COM/p/widget")
    b = normalize_url("https://shop.example.com/p/widget")
    assert a == b


def test_strips_trailing_slash_except_root():
    a = normalize_url("https://shop.example.com/p/widget/")
    b = normalize_url("https://shop.example.com/p/widget")
    assert a == b

    root = normalize_url("https://shop.example.com/")
    assert root.endswith("/")


def test_strips_default_ports():
    a = normalize_url("https://shop.example.com:443/p/widget")
    b = normalize_url("https://shop.example.com/p/widget")
    assert a == b

    a2 = normalize_url("http://shop.example.com:80/p/widget")
    b2 = normalize_url("http://shop.example.com/p/widget")
    assert a2 == b2


def test_keeps_non_default_port():
    a = normalize_url("https://shop.example.com:8443/p/widget")
    assert ":8443" in a


def test_strips_fragment():
    a = normalize_url("https://shop.example.com/p/widget#reviews")
    b = normalize_url("https://shop.example.com/p/widget")
    assert a == b


def test_amazon_ref_truncation():
    a = normalize_url("https://www.amazon.com/dp/B0ABC123/ref=sr_1_3")
    b = normalize_url("https://www.amazon.com/dp/B0ABC123")
    assert a == b


def test_amazon_ref_not_applied_to_other_domains():
    # a path literally containing "/ref=" on a non-amazon domain is left alone
    a = normalize_url("https://shop.example.com/products/ref=thing")
    assert "/ref=thing" in a


@pytest.mark.parametrize("scheme", ["ftp", "javascript", "file"])
def test_rejects_non_http_schemes(scheme):
    with pytest.raises(InvalidUrlError):
        normalize_url(f"{scheme}://shop.example.com/p/widget")


def test_rejects_missing_host():
    with pytest.raises(InvalidUrlError):
        normalize_url("https:///p/widget")


def test_rejects_overlong_url():
    long_url = "https://shop.example.com/" + "a" * 3000
    with pytest.raises(InvalidUrlError):
        normalize_url(long_url)


def test_rejects_empty():
    with pytest.raises(InvalidUrlError):
        normalize_url("")


def test_idempotent():
    raw = "HTTPS://Shop.Example.COM:443/p/widget/?utm_source=fb&b=2&a=1#frag"
    once = normalize_url(raw)
    twice = normalize_url(once)
    assert once == twice


def test_url_hash_is_stable_sha256_hexdigest():
    normalized = normalize_url("https://shop.example.com/p/widget")
    h1 = url_hash(normalized)
    h2 = url_hash(normalized)
    assert h1 == h2
    assert len(h1) == 64
    assert all(c in "0123456789abcdef" for c in h1)


def test_domain_of_strips_www():
    normalized = normalize_url("https://www.shop.example.com/p/widget")
    assert domain_of(normalized) == "shop.example.com"


def test_domain_of_keeps_non_www_subdomain():
    normalized = normalize_url("https://store.example.com/p/widget")
    assert domain_of(normalized) == "store.example.com"
