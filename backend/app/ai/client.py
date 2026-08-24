"""Lazy Gemini client plus the one call shape every AI feature here uses.

Sync `genai.Client` (not the async one) because both callers — the Celery
workers and FastAPI's threadpool — are fine with a blocking call for these
short, low-volume requests.

Two hard-won rules are encoded in `generate_structured` rather than left to
each caller to remember:

1. **Thinking must be off — but not every model will accept being told so.**
   A thinking-capable model spends `max_output_tokens` on deliberation
   *before* emitting any JSON. Measured against gemini-3.5-flash with a system
   instruction and a 512-token cap: 0 of 4 calls produced output — every one
   finished with MAX_TOKENS after ~490 thinking tokens, and the SDK raised
   nothing (`response.parsed` was simply None). `thinking_budget=0` fixes that
   model. But gemini-3.5-flash-lite rejects the same argument outright with a
   400, because it does not think in the first place.

   Rather than hardcode a model->capability table that rots every time
   Google ships a model, the call sends `thinking_budget=0` and, on a 400,
   retries once without it and remembers that model for the process lifetime.
   Self-correcting in both directions.
2. **`parsed is None` is a failure, not an empty result.** It is the shape a
   truncated or schema-violating response takes, so every caller treats it as
   "no answer" rather than dereferencing it.
"""
from __future__ import annotations

import logging
from typing import Type, TypeVar

from google import genai
from google.genai import errors, types
from pydantic import BaseModel

from ..settings import settings

logger = logging.getLogger(__name__)

_client: genai.Client | None = None

T = TypeVar("T", bound=BaseModel)


def is_enabled() -> bool:
    """False when no API key is configured — every caller must degrade
    gracefully (extraction falls back to structured-data-only; the verdict
    endpoint reports 'unavailable') rather than error."""
    return bool(settings.gemini_api_key)


def get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


class RateLimitedError(RuntimeError):
    """429 from the API. Distinct from other failures because it is the one
    worth retrying with backoff — see the Celery `autoretry_for` in tasks.py."""


class TransientAIError(RuntimeError):
    """5xx from the API (503 UNAVAILABLE is common on in-demand models).
    Also worth a retry."""


# Models observed to reject `thinking_config` with a 400. Populated at runtime
# by the retry below, so a new model is handled without a code change.
_NO_THINKING_CONFIG: set[str] = set()


def _build_config(
    *, system: str, schema: Type[T], max_output_tokens: int, with_thinking_config: bool
) -> types.GenerateContentConfig:
    kwargs = dict(
        system_instruction=system,
        response_mime_type="application/json",
        response_schema=schema,
        max_output_tokens=max_output_tokens,
    )
    if with_thinking_config:
        # See rule 1 in the module docstring. Without this, a thinking model
        # silently returns nothing.
        kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
    return types.GenerateContentConfig(**kwargs)


def generate_structured(
    *,
    model: str,
    system: str,
    prompt: str,
    schema: Type[T],
    max_output_tokens: int,
) -> T | None:
    """One structured-output call. Returns the parsed model, or None when the
    model declined to produce a usable answer.

    Raises RateLimitedError / TransientAIError for the two retryable classes;
    every other API failure degrades to None so a background job is never
    blocked by an AI outage.
    """
    client = get_client()
    send_thinking_config = model not in _NO_THINKING_CONFIG

    def _call(with_thinking_config: bool):
        return client.models.generate_content(
            model=model,
            contents=prompt,
            config=_build_config(
                system=system,
                schema=schema,
                max_output_tokens=max_output_tokens,
                with_thinking_config=with_thinking_config,
            ),
        )

    try:
        try:
            response = _call(send_thinking_config)
        except errors.ClientError as exc:
            # A model that does not think rejects being told not to think.
            # Learn it once, then stop sending the argument to that model.
            if send_thinking_config and getattr(exc, "code", None) == 400:
                logger.info(
                    "%s rejected thinking_config; retrying without it", model
                )
                _NO_THINKING_CONFIG.add(model)
                response = _call(False)
            else:
                raise
    except errors.ClientError as exc:
        if getattr(exc, "code", None) == 429:
            raise RateLimitedError(str(exc)) from exc
        logger.warning("gemini client error (%s): %s", getattr(exc, "code", "?"), exc)
        return None
    except errors.ServerError as exc:
        raise TransientAIError(str(exc)) from exc
    except errors.APIError as exc:
        logger.warning("gemini api error: %s", exc)
        return None

    parsed = response.parsed
    if parsed is None:
        finish = None
        if response.candidates:
            finish = response.candidates[0].finish_reason
        logger.warning("gemini returned no parsable output (finish_reason=%s)", finish)
        return None
    return parsed
