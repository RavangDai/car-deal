"""Assign a coarse taxonomy category to a tracked product.

The model sees only the product title and its domain — never page HTML and
never price data. Category is a routing hint for a personalized feed, not a
claim about the product, so a wrong answer costs a slightly-off recommendation
and nothing more.

Degrades to None whenever it cannot answer confidently, when no Gemini key
is configured, or when the API errors. None means "uncategorised", which every
consumer already handles — there is no retry queue and no failure state.
"""
from __future__ import annotations

import logging
from typing import Literal, Optional

from pydantic import BaseModel

from ..taxonomy import CATEGORIES, normalize
from .client import RateLimitedError, TransientAIError, generate_structured, is_enabled

logger = logging.getLogger(__name__)

_CATEGORY_LINES = "\n".join(f"  {slug} — {label}" for slug, label in CATEGORIES.items())

CATEGORIZE_SYSTEM = (
    "You assign a single coarse category to an e-commerce product, given only "
    "its title and the store domain.\n\n"
    "Valid categories:\n"
    f"{_CATEGORY_LINES}\n\n"
    "Rules:\n"
    "- Answer with exactly one slug from the list above, or the string 'unknown'.\n"
    "- Use 'unknown' when the title is too vague to place, or when the product "
    "clearly belongs to none of these categories. A wrong category is worse "
    "than no category.\n"
    "- Do not explain. Do not invent slugs."
)

# Literal of the real slugs plus the explicit escape hatch, so the model is
# constrained by the schema rather than by prompt discipline alone.
CategorySlug = Literal[
    "electronics",
    "kitchen",
    "gaming",
    "home",
    "fashion",
    "fitness",
    "beauty",
    "tools",
    "unknown",
]


class CategoryResult(BaseModel):
    category: CategorySlug


def categorize_product(title: str | None, domain: str, model: str) -> Optional[str]:
    """Return a taxonomy slug, or None if it could not be determined."""
    if not is_enabled():
        return None
    if not title or not title.strip():
        return None

    try:
        parsed = generate_structured(
            model=model,
            system=CATEGORIZE_SYSTEM,
            prompt=f"Title: {title}\nStore: {domain}",
            schema=CategoryResult,
            max_output_tokens=64,
        )
    except (RateLimitedError, TransientAIError) as exc:
        # Categorisation runs inline inside the track job and is never worth
        # retrying at the cost of blocking it — the product simply stays
        # uncategorised. This is why it swallows the retryable errors that
        # extraction and verdict deliberately let propagate.
        logger.warning("categorization unavailable for %s: %s", domain, exc)
        return None

    if parsed is None or parsed.category == "unknown":
        return None
    # Re-validate against the taxonomy rather than trusting the Literal: the
    # two can drift if a slug is removed from taxonomy.py without updating
    # CategorySlug, and the column must never hold an unknown value.
    return normalize(parsed.category)
