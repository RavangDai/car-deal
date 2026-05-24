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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
