from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any


@dataclass(frozen=True)
class ExtractedProduct:
    title: str
    price: Decimal
    currency: str
    image_url: str | None
    in_stock: bool


@dataclass(frozen=True)
class FetchResult:
    html: str
    final_url: str
    status_code: int


@dataclass(frozen=True)
class ExtractionResult:
    product: ExtractedProduct
    strategy: str  # 'json_ld' | 'og_meta' | 'microdata' | 'llm'
    meta: dict[str, Any]
