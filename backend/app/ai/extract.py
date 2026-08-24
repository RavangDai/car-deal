"""LLM extraction fallback — only invoked when the free structured-data
parsers (JSON-LD/og/microdata) fail to find a product on the page. Input is
always the cleaned, capped page content from `extraction.html_clean`, never
a raw page."""
from __future__ import annotations

import logging
from decimal import Decimal

from pydantic import BaseModel

from ..extraction.types import ExtractedProduct
from .client import generate_structured, is_enabled

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

    parsed = generate_structured(
        model=model,
        system=EXTRACTION_SYSTEM,
        prompt=f"URL: {url}\n\nPage content:\n{cleaned_content}",
        schema=LLMExtractedProduct,
        max_output_tokens=1024,
    )

    # A None here is either "the model found no product" or a transient
    # non-retryable failure; both mean the same thing to the pipeline, which
    # goes on to raise ExtractionFailedError.
    if parsed is None or parsed.price is None or parsed.price <= 0:
        return None

    return ExtractedProduct(
        title=parsed.title.strip(),
        price=Decimal(str(parsed.price)),
        currency=(parsed.currency or "USD").upper(),
        image_url=parsed.image_url,
        in_stock=parsed.in_stock,
    )
