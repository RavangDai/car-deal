"""Real email delivery via Resend (https://resend.com). Sync httpx, matching
the rest of the codebase's Celery-worker convention."""
from __future__ import annotations

import httpx

from ..settings import settings

RESEND_API_URL = "https://api.resend.com/emails"


class ResendEmailSender:
    def send(self, *, to: str, subject: str, html: str) -> None:
        response = httpx.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.email_from,
                "to": [to],
                "subject": subject,
                "html": html,
            },
            timeout=10.0,
        )
        response.raise_for_status()
