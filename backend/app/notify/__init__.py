from __future__ import annotations

from ..settings import settings
from .base import EmailSender
from .console import ConsoleEmailSender
from .resend import ResendEmailSender

__all__ = ["EmailSender", "get_email_sender"]


def get_email_sender() -> EmailSender:
    if settings.email_backend == "resend" and settings.resend_api_key:
        return ResendEmailSender()
    return ConsoleEmailSender()
