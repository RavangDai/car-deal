from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/cardeals"
    redis_url: str = "redis://localhost:6379"

    # JWT / auth
    secret_key: str = "changeme-please-set-in-env"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24h

    # NoDecode: don't let pydantic-settings JSON-decode the env var, so a plain
    # comma-separated string (ALLOWED_ORIGINS=a,b) works as well as a JSON list.
    allowed_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _parse_allowed_origins(cls, v: object) -> object:
        if isinstance(v, str):
            s = v.strip()
            if s.startswith("["):  # tolerate a JSON array too
                import json

                return json.loads(s)
            return [origin.strip() for origin in s.split(",") if origin.strip()]
        return v

    # Donations (Stripe Checkout). Leave the key blank to disable the endpoint.
    stripe_secret_key: str = ""
    frontend_url: str = "http://localhost:5173"

    # Craigslist scraper
    scraper_user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
    scraper_request_timeout: float = 20.0

    # OAuth (social login). Leave a provider's id/secret blank to disable it.
    google_client_id: str = ""
    google_client_secret: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""
    # Public base URL of THIS backend — used to build the OAuth callback URLs.
    oauth_redirect_base: str = "http://localhost:8000"

    # Session cookie. In prod (cross-site frontend/backend) set
    # cookie_secure=True + cookie_samesite="none".
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    cookie_domain: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
