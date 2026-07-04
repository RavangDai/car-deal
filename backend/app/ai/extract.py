"""LLM extraction fallback — only invoked when the free structured-data
parsers (JSON-LD/og/microdata) fail to find a product on the page. Input is
always the cleaned, capped page content from `extraction.html_clean`, never
a raw page."""
from __future__ import annotations

import logging
from decimal import Decimal

import anthropic
from pydantic import BaseModel

from ..extraction.types import ExtractedProduct
from .client import get_client, is_enabled

logger = logging.getLogger(__name__)

EXTRACTION_SYSTEM = (
    "You extract product data from e-commerce page content. Extract only "
    "what is present on the page — never guess or invent a price. If no "
    "clear current price is present, set price to null."
)


class LLMExtractedProduct(BaseModel):
    title: str
    price: float | None
    currency: str | None
    image_url: str | None
    in_stock: bool


def llm_extract_product(
    cleaned_content: str, url: str, model: str
) -> ExtractedProduct | None:
    if not is_enabled():
        return None

    client = get_client()
    try:
        response = client.messages.parse(
            model=model,
            max_tokens=1024,
            system=EXTRACTION_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": f"URL: {url}\n\nPage content:\n{cleaned_content}",
                }
            ],
            output_format=LLMExtractedProduct,
        )
    except anthropic.RateLimitError:
        # Transient — let the caller's Celery autoretry_for handle backoff
        # rather than silently giving up on this attempt.
        raise
    except anthropic.APIError as exc:
        logger.warning("LLM extraction failed for %s: %s", url, exc)
        return None

    parsed = response.parsed_output
    if parsed is None or parsed.price is None or parsed.price <= 0:
        return None

    return ExtractedProduct(
        title=parsed.title.strip(),
        price=Decimal(str(parsed.price)),
        currency=(parsed.currency or "USD").upper(),
        image_url=parsed.image_url,
        in_stock=parsed.in_stock,
    )
