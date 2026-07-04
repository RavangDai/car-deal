from __future__ import annotations

from decimal import Decimal

from ..settings import settings


def render_price_drop_email(
    *,
    product_title: str,
    previous_price: Decimal | None,
    new_price: Decimal,
    currency: str,
    deal_score: Decimal | None,
    product_id: str,
) -> tuple[str, str]:
    pct: float | None = None
    if previous_price is not None and previous_price > 0:
        pct = round(float((previous_price - new_price) / previous_price * 100), 1)

    subject = f"Price drop: {product_title}"
    pct_line = f" ({pct}% off)" if pct is not None else ""
    was_line = f"{currency} {previous_price}" if previous_price is not None else "an unknown price"
    score_line = (
        f'<p>Deal score: <strong>{deal_score}</strong>/100</p>' if deal_score is not None else ""
    )

    html = f"""
    <div style="font-family: sans-serif; max-width: 480px;">
      <h2>{product_title}</h2>
      <p>Now {currency} {new_price}{pct_line} — was {was_line}.</p>
      {score_line}
      <p><a href="{settings.frontend_url}/#/product/{product_id}">View price history</a></p>
    </div>
    """.strip()

    return subject, html
