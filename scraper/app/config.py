"""config.py — Application configuration via environment variables."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Paths
    data_dir: Path = Path(__file__).resolve().parents[2] / "data"

    # Servers
    scraper_port: int = 8100
    web_base_url: str = "http://localhost:3000"

    # Mailpit SMTP sandbox
    mailpit_smtp_host: str = "localhost"
    mailpit_smtp_port: int = 1025

    # LLM (DeepSeek)
    deepseek_api_key: str = ""
    llm_model: str = "deepseek-chat"

    # Scraper behaviour
    scraper_rate_limit_delay: float = 2.0  # seconds between requests to same domain
    scraper_cron_hour: int = 0  # 00:00 SGT
    scraper_cron_timezone: str = "Asia/Singapore"


settings = Settings()
