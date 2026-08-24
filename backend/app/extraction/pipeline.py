"""Extraction orchestration: fetch -> structured chain -> LLM fallback ->
validate, plus the strategy-recording behavior that keeps recheck cost down.

Cost-critical design note: `recheck_product` always tries the free
structured-data chain first, regardless of which strategy last succeeded.
The recorded strategy on `Product.extraction_strategy` is a *hint* for
display/diagnostics, not a shortcut that skips straight to the LLM — a
naive "reuse last strategy" reading would mean one Claude call per product
per day forever for any site that needed the LLM once. Running structured
parsing first is free, and lets a product self-heal off the LLM path the
day a site adds JSON-LD.
"""
from __future__ import annotations

import dataclasses
import logging
import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Callable
from urllib.parse import urljoin, urlsplit

from ..urlnorm import domain_of
from . import unblocker
from .fetch import FetchError, SsrfBlockedError, safe_fetch
from .llm import llm_extract
from .structured import extract_structured
from .types import ExtractedProduct, ExtractionResult

MAX_PLAUSIBLE_PRICE = Decimal("10000000")
KNOWN_CURRENCIES = {
    "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "MXN", "BRL", "CHF",
    "SEK", "NOK", "DKK", "NZD", "CNY", "KRW", "SGD", "HKD", "ZAR", "PLN",
}

# Vendor-specific challenge markers. Each of these appears only on an actual
# interstitial — never in an asset URL on a page that serves fine.
_CHALLENGE_MARKERS = (
    "/cdn-cgi/challenge-platform",
    "cf-browser-verification",
    "cf_chl_opt",
    "_incapsula_resource",
    "px-captcha",
    "distil_r_captcha",
    # Amazon's interstitial. Observed 2026-08-24: a 3.7 KB page with a captcha
    # form and no product markup, which carried none of the markers above and
    # no <title> at all — so it was being misreported as "no product found"
    # rather than a block. The two drive different consecutive_failures
    # accounting and different user-facing messages, so the distinction matters.
    "/errors_page/validatecaptcha",
    "validatecaptcha",
)

# Weaker signal: a page that announces a block in its <title>. Only trusted on
# a page too small to be a real product page.
#
# Each phrase below is one a bot-defense vendor actually ships, and is chosen
# to be distinctive enough that a real product page is unlikely to carry it.
# Generic wording ("security check", "verification") is deliberately excluded —
# it appears on legitimate checkout and account pages.
_CHALLENGE_TITLE_PATTERNS = (
    "attention required",      # Cloudflare, classic
    "just a moment",           # Cloudflare, current
    "checking your browser",   # Cloudflare, I'm-Under-Attack
    "verifying you are human", # Cloudflare Turnstile
    "access denied",
    "robot check",             # Amazon
    "are you a human",         # Newegg — observed 2026-08-01
    "robot or human",          # Walmart / PerimeterX — observed 2026-08-01
    "pardon our interruption", # Imperva / Distil
)

# Interstitials are small — they are a stub plus a JS widget. The real Walmart
# challenge page measured 15,562 bytes and the Newegg one 14,619, while real
# product pages run from hundreds of KB into the megabytes (Allbirds: ~1.99 MB).
# 100 KB sits ~6x above the observed interstitials and roughly an order of
# magnitude below a real product page, so the gate still rejects a genuine page
# whose title merely reads like a challenge.
#
# This was 15_000 and let Walmart's page through — the title rule never fired,
# and only a `px-captcha` marker caught it. A vendor without a marker we know
# would have gone undetected.
_CHALLENGE_MAX_BYTES = 100_000

_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)

logger = logging.getLogger(__name__)


class ExtractionFailedError(RuntimeError):
    """Neither structured parsing nor the LLM fallback found a valid
    product on the page."""


def _validate(product: ExtractedProduct) -> None:
    if product.price <= 0 or product.price >= MAX_PLAUSIBLE_PRICE:
        raise ValueError(f"implausible price: {product.price}")
    if not product.title or not product.title.strip():
        raise ValueError("empty title")
    if product.currency not in KNOWN_CURRENCIES:
        raise ValueError(f"unrecognized currency: {product.currency}")


def _title_of(html: str) -> str:
    match = _TITLE_RE.search(html)
    return match.group(1).strip().lower() if match else ""


def _looks_bot_walled(html: str) -> bool:
    """True only for pages carrying a vendor-specific challenge marker, or
    announcing a block in their <title> on a page too small to hold a product.

    Deliberately does *not* match a bare "cloudflare" substring. A large share
    of the legitimate web loads assets from cdnjs.cloudflare.com, which put
    that string in the <head> of pages that block nothing — and the old check
    rejected them before parsing was ever attempted.
    """
    lowered = html.lower()
    if any(marker in lowered for marker in _CHALLENGE_MARKERS):
        return True
    return len(html) < _CHALLENGE_MAX_BYTES and any(
        pattern in _title_of(html) for pattern in _CHALLENGE_TITLE_PATTERNS
    )


def _absolutize_image(product: ExtractedProduct, final_url: str) -> ExtractedProduct:
    """Resolve a relative image URL against the page it came from.

    Every extraction strategy can hand back a relative path -- JSON-LD
    "image", og:image, and microdata src are all routinely site-root-relative
    ("/images/items/cart2.png"). Stored verbatim, the browser resolves them
    against the *app's* origin instead of the retailer's, so every product
    thumbnail 404s against localhost. The image was there all along; we were
    throwing away the origin.

    Anything already absolute passes through untouched, and a value that
    cannot be made absolute becomes None rather than a broken <img>.
    """
    raw = product.image_url
    if not raw or not raw.strip():
        return product

    raw = raw.strip()
    if raw.startswith("data:"):
        return product

    resolved = urljoin(final_url, raw)
    parts = urlsplit(resolved)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        # Junk we cannot turn into a fetchable URL. The placeholder the UI
        # already falls back to is better than a broken image.
        return dataclasses.replace(product, image_url=None)

    if resolved == raw:
        return product
    return dataclasses.replace(product, image_url=resolved)


def _extract_from_html(
    html: str,
    final_url: str,
    *,
    on_stage: Callable[[str], None] | None,
    allow_llm: bool,
) -> ExtractionResult | None:
    """Structured chain, then the LLM fallback, over one fetched page.

    Returns None when the page yielded nothing usable. Raises only for an
    implausible extraction (via `_validate`), which is a permanent data
    problem rather than a "try harder" signal.
    """
    if on_stage:
        on_stage("parsing")
    structured = extract_structured(html)
    if structured is not None:
        product, strategy = structured
        _validate(product)
        product = _absolutize_image(product, final_url)
        return ExtractionResult(
            product=product, strategy=strategy, meta={"final_url": final_url}
        )

    if not allow_llm:
        return None

    if on_stage:
        on_stage("llm_fallback")
    product = llm_extract(html, final_url)
    if product is not None:
        _validate(product)
        product = _absolutize_image(product, final_url)
        return ExtractionResult(
            product=product, strategy="llm", meta={"final_url": final_url}
        )
    return None


def extract_product(
    url: str, on_stage: Callable[[str], None] | None = None
) -> ExtractionResult:
    """First-track extraction, used when a user pastes a new URL. Raises
    on failure — the caller (Celery task) turns that into a job-failure
    state visible to the poller. `on_stage` is an optional progress hook
    (called with 'fetching' / 'parsing' / 'llm_fallback' / 'unblocking') so
    the tracking job can report granular status to the poller."""
    if on_stage:
        on_stage("fetching")
    fetch_result = safe_fetch(url)

    # Only ask whether the page was a wall *after* parsing has had its chance.
    # Judging before parsing meant a page we could read fine was rejected on a
    # substring; judging after means a successful parse settles it. Still ahead
    # of the LLM, so we never pay to send a challenge page to the model.
    walled = _looks_bot_walled(fetch_result.html)
    result = _extract_from_html(
        fetch_result.html, fetch_result.final_url,
        on_stage=on_stage, allow_llm=not walled,
    )
    if result is not None:
        return result

    # Content-level escalation. `safe_fetch` already escalates when the site
    # refuses at the transport layer (403/429/timeout), but a challenge page
    # arrives as a perfectly ordinary 200 — Amazon and Walmart both did in the
    # 2026-08-24 probe. That is only detectable here, with the HTML in hand.
    domain = domain_of(url)
    if unblocker.is_configured() and unblocker.handles_domain(domain):
        if on_stage:
            on_stage("unblocking")
        try:
            unblocked = unblocker.fetch_unblocked(url)
        except unblocker.UnblockerError as exc:
            logger.warning("unblocker escalation failed for %s: %s", url, exc)
        else:
            result = _extract_from_html(
                unblocked.html, unblocked.final_url,
                on_stage=on_stage,
                # A page fetched through the unblocker should not be a wall;
                # if it still looks like one, do not pay the LLM to read it.
                allow_llm=not _looks_bot_walled(unblocked.html),
            )
            if result is not None:
                return result

    if walled:
        raise ExtractionFailedError(f"{url} appears to block automated checks")
    raise ExtractionFailedError(f"could not extract a product from {url}")


@dataclass(frozen=True)
class RecheckOutcome:
    product: ExtractedProduct | None
    strategy: str | None
    blocked: bool
    blocked_reason: str | None
    failed: bool


def recheck_product(url: str) -> RecheckOutcome:
    """Daily recheck: always structured-first (see module docstring), LLM
    only as today's fallback. Never raises — every failure mode is
    represented in the returned outcome so the caller can update
    `Product.status`/`consecutive_failures` accordingly."""
    try:
        fetch_result = safe_fetch(url)
    except SsrfBlockedError:
        return RecheckOutcome(
            product=None, strategy=None, blocked=True, blocked_reason="ssrf", failed=True
        )
    except FetchError as exc:
        if exc.status_code in (403, 429):
            return RecheckOutcome(
                product=None,
                strategy=None,
                blocked=True,
                blocked_reason=f"http_{exc.status_code}",
                failed=True,
            )
        return RecheckOutcome(
            product=None, strategy=None, blocked=False, blocked_reason=None, failed=True
        )

    structured = extract_structured(fetch_result.html)
    if structured is not None:
        product, strategy = structured
        try:
            _validate(product)
        except ValueError:
            pass
        else:
            return RecheckOutcome(
                product=product, strategy=strategy, blocked=False, blocked_reason=None, failed=False
            )

    # Structured-first, same as extract_product — see the note there.
    if _looks_bot_walled(fetch_result.html):
        return RecheckOutcome(
            product=None, strategy=None, blocked=True, blocked_reason="bot_wall", failed=True
        )

    product = llm_extract(fetch_result.html, fetch_result.final_url)
    if product is not None:
        try:
            _validate(product)
        except ValueError:
            pass
        else:
            return RecheckOutcome(
                product=product, strategy="llm", blocked=False, blocked_reason=None, failed=False
            )

    return RecheckOutcome(
        product=None, strategy=None, blocked=False, blocked_reason=None, failed=True
    )
