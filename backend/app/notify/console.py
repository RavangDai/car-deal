"""Dev-default email backend: logs the rendered email instead of sending it.
Zero external dependency — `docker compose up` with no secrets configured
still lets you see the full alert-email flow end to end."""
from __future__ import annotations

import logging

logger = logging.getLogger("wasitcheaper.email")


class ConsoleEmailSender:
    def send(self, *, to: str, subject: str, html: str) -> None:
        logger.info(
            "=== EMAIL to %s ===\nSubject: %s\n\n%s\n=== END EMAIL ===",
            to,
            subject,
            html,
        )
