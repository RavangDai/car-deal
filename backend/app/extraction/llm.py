"""Thin wrapper around the Claude extraction fallback — keeps `pipeline.py`
free of any direct dependency on the Gemini SDK or app.ai internals."""
from __future__ import annotations

from ..settings import settings
from .html_clean import clean_for_llm
from .types import ExtractedProduct


def llm_extract(html: str, url: str) -> ExtractedProduct | None:
    from ..ai.extract import llm_extract_product  # lazy: don't import the Gemini SDK unless used

    cleaned = clean_for_llm(html)
    return llm_extract_product(cleaned, url, model=settings.ai_extraction_model)
