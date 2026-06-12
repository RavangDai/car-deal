from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/cardeals"
    redis_url: str = "redis://localhost:6379"

    # JWT / auth
    secret_key: str = "changeme-please-set-in-env"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24h

    allowed_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Donations (Stripe Checkout). Leave the key blank to disable the endpoint.
    stripe_secret_key: str = ""
    frontend_url: str = "http://localhost:5173"

    # Craigslist scraper
    scraper_user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
    scraper_request_timeout: float = 20.0

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
