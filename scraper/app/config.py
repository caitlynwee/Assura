"""config.py — Application configuration via environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Servers
    scraper_port: int = 8100
    web_base_url: str = "http://localhost:3000"
    internal_api_secret: str = "dev-internal-key"

    # Mailpit SMTP sandbox (default: nothing leaves the machine)
    mailpit_smtp_host: str = "localhost"
    mailpit_smtp_port: int = 1025

    # Real SMTP delivery (OPTIONAL — overrides Mailpit when smtp_host is set).
    # Set these to actually deliver to real inboxes (e.g. Gmail SMTP). Leaving
    # smtp_host empty keeps all mail in the local Mailpit sandbox.
    smtp_host: str = ""           # e.g. "smtp.gmail.com"
    smtp_port: int = 587          # Gmail STARTTLS
    smtp_username: str = ""       # e.g. your-sender@gmail.com
    smtp_password: str = ""       # Gmail App Password (not the account password)
    smtp_from: str = ""           # optional envelope From; defaults to smtp_username

    # Database
    database_url: str = ""

    # LLM
    anthropic_api_key: str = ""
    llm_model: str = "claude-haiku-4-5-20251001"

    # Scraper behaviour
    scraper_rate_limit_delay: float = 2.0  # seconds between requests to same domain
    scraper_cron_hour: int = 0  # 00:00 SGT
    scraper_cron_timezone: str = "Asia/Singapore"


settings = Settings()
