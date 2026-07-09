    """URL normalization for product identity.

Two different URLs (with different tracking params, casing, or trailing
slashes) that point at the same product must resolve to the same
`url_hash` — otherwise the same product gets tracked twice under two rows.
Uses a tracking-param *blacklist* rather than a whitelist: product identity
often lives in the query string itself (e.g. `?id=B0ABC123`), so stripping
everything except a known-safe allowlist would break identity for sites we
haven't special-cased.
"""
from __future__ import annotations

import hashlib
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

MAX_URL_LENGTH = 2048

_ALLOWED_SCHEMES = {"http", "https"}
_DEFAULT_PORTS = {"http": 80, "https": 443}

# Tracking / analytics params that don't affect product identity. Prefixes
# and exact names both handled below.
_TRACKING_PARAM_PREFIXES = ("utm_",)
_TRACKING_PARAM_NAMES = {
    "gclid",
    "fbclid",
    "msclkid",
    "mc_eid",
    "igshid",
    "srsltid",
    "ref",
    "ref_",
    "tag",
    "linkcode",
    "spm",
    "_ga",
    "yclid",
    "dclid",
    "twclid",
}


class InvalidUrlError(ValueError):
    pass


def _is_tracking_param(key: str) -> bool:
    lowered = key.lower()
    if lowered in _TRACKING_PARAM_NAMES:
        return True
    return any(lowered.startswith(prefix) for prefix in _TRACKING_PARAM_PREFIXES)


def _strip_amazon_ref(path: str, host: str) -> str:
    """Amazon encodes session/referral junk after `/ref=` in the path itself
    (not the query string) — e.g. `/dp/B0ABC123/ref=sr_1_3?...`. Truncate it."""
    if "amazon." not in host:
        return path
    idx = path.find("/ref=")
    if idx == -1:
        return path
    return path[:idx]


def normalize_url(raw: str) -> str:
    if not raw or len(raw) > MAX_URL_LENGTH:
        raise InvalidUrlError(f"URL missing or exceeds {MAX_URL_LENGTH} chars")

    parsed = urlparse(raw.strip())
    scheme = parsed.scheme.lower()
    if scheme not in _ALLOWED_SCHEMES:
        raise InvalidUrlError(f"unsupported scheme: {scheme!r}")
    if not parsed.hostname:
        raise InvalidUrlError("URL has no host")

    host = parsed.hostname.lower()
    port = parsed.port
    if port is not None and port != _DEFAULT_PORTS.get(scheme):
        host = f"{host}:{port}"

    path = _strip_amazon_ref(parsed.path, host)
    if len(path) > 1 and path.endswith("/"):
        path = path.rstrip("/")
    if not path:
        path = "/"

    query_pairs = [
        (k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if not _is_tracking_param(k)
    ]
    query_pairs.sort()
    query = urlencode(query_pairs)

    normalized = urlunparse((scheme, host, path, "", query, ""))
    return normalized


def url_hash(normalized: str) -> str:
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def domain_of(normalized: str) -> str:
    host = urlparse(normalized).hostname or ""
    if host.startswith("www."):
        host = host[4:]
    return host
