"""'Buy or Wait' verdict generation. The model receives ONLY the computed
`PriceStats` — never raw price history — so it explains the deterministic
math rather than re-deriving (and potentially hallucinating) trends itself.
The deal math stays real statistics; the LLM's job is strictly to narrate
it in the brand voice."""
from __future__ import annotations

import logging
from typing import Literal

import anthropic
from pydantic import BaseModel

from ..dealmath import PriceStats
from .client import get_client, is_enabled

logger = logging.getLogger(__name__)

VERDICT_SYSTEM = (
    "You are WasItCheaper's price analyst. You are given verified price "
    "statistics for a tracked product — never raw price history. Write a "
    "short, quirky-but-factual verdict for a shopper deciding whether to "
    "buy now. Never invent numbers; cite only the figures given to you. "
    "Keep the rationale under 60 words."
)


class VerdictResult(BaseModel):
    verdict: Literal["buy", "wait", "watch"]
    rationale: str
    confidence: Literal["low", "medium", "high"]


def generate_verdict(
    stats: PriceStats, product_title: str, currency: str, model: str
) -> VerdictResult | None:
    if not is_enabled():
        return None

    facts = {
        "product": product_title,
        "currency": currency,
        "current_price": str(stats.latest_price),
        "median_90d": str(stats.median_90d) if stats.median_90d is not None else None,
        "min_ever": str(stats.min_ever) if stats.min_ever is not None else None,
        "is_lowest_ever": stats.is_lowest_ever,
        "discount_vs_median_pct": stats.discount_vs_median_pct,
        "historical_rarity_0_to_1": stats.rarity,
        "pre_drop_stability_0_to_1": stats.stability,
        "drop_freshness_0_to_1": stats.drop_freshness,
        "deal_score_0_to_100": stats.deal_score,
        "days_tracked": stats.coverage_days,
    }

    client = get_client()
    try:
        response = client.messages.parse(
            model=model,
            max_tokens=512,
            system=VERDICT_SYSTEM,
            messages=[{"role": "user", "content": str(facts)}],
            output_format=VerdictResult,
        )
    except anthropic.RateLimitError:
        raise
    except anthropic.APIError as exc:
        logger.warning("verdict generation failed: %s", exc)
        return None

    return response.parsed_output
