"""Optional donations via Stripe Checkout.

Revveal is free for buyers — this endpoint just lets fans chip in. It is public
(no auth) so anyone, including guests, can support the project. The handler is a
plain ``def`` on purpose: the Stripe SDK is synchronous, so FastAPI runs it in a
threadpool instead of blocking the event loop.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
import stripe

from .limiter import limiter
from .settings import settings

router = APIRouter(tags=["donations"])

MIN_CENTS = 100      # $1
MAX_CENTS = 50_000   # $500


class DonationIn(BaseModel):
    amount_cents: int


class DonationOut(BaseModel):
    url: str


@router.post("/donate", response_model=DonationOut)
@limiter.limit("10/minute")
def create_donation_checkout(request: Request, payload: DonationIn):
    if not settings.stripe_secret_key:
        # Degrade gracefully so the UI can show a friendly "not set up yet" note.
        raise HTTPException(status_code=503, detail="Donations are not configured")
    if not (MIN_CENTS <= payload.amount_cents <= MAX_CENTS):
        raise HTTPException(status_code=400, detail="Donation must be between $1 and $500")

    stripe.api_key = settings.stripe_secret_key
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {"name": "Revveal donation"},
                        "unit_amount": payload.amount_cents,
                    },
                    "quantity": 1,
                }
            ],
            success_url=f"{settings.frontend_url}/?donate=success",
            cancel_url=f"{settings.frontend_url}/?donate=cancelled",
        )
    except Exception as exc:  # Stripe network/config error — surface as a clean 502.
        raise HTTPException(status_code=502, detail="Could not start checkout") from exc

    return DonationOut(url=session.url)
