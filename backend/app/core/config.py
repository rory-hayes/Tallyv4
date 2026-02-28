from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Tally Payroll Reconciliation"
    environment: str = "development"
    api_prefix: str = "/v1"

    database_url: str = "sqlite:///./data/tally.db"
    redis_url: str = "redis://localhost:6379/0"

    storage_mode: str = "local"
    local_storage_path: str = "./data/storage"
    aws_region: str = "eu-west-2"
    s3_bucket_name: str | None = None

    magic_link_secret: str = "replace-me"
    magic_link_ttl_minutes: int = 20
    access_token_ttl_minutes: int = 480

    amount_tolerance: float = 0.01
    date_window_business_days: int = 2

    supported_currencies: list[str] = Field(default_factory=lambda: ["GBP", "EUR"])

    uk_hmrc_due_day: int = 22
    ie_due_days_offline: int = 14
    ie_due_days_ros: int = 23

    default_timezone: str = "Europe/London"

    max_upload_bytes: int = 25 * 1024 * 1024


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()

    # Ensure local paths exist in development mode.
    if settings.storage_mode == "local":
        storage_path = Path(settings.local_storage_path)
        storage_path.mkdir(parents=True, exist_ok=True)

    db_path = settings.database_url.removeprefix("sqlite:///")
    if settings.database_url.startswith("sqlite:///") and db_path:
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    return settings
