"""config.py — Application configuration via environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Servers
    scraper_port: int = 8100

    # Database
    database_url: str = ""

    # LLM (DeepSeek)
    deepseek_api_key: str = ""
    llm_model: str = "deepseek-chat"

    # Firecrawl — web search for PDF brochure + product page URLs
    fire_crawl_api_key: str = ""

    # Scraper behaviour
    scraper_rate_limit_delay: float = 2.0  # seconds between requests to same domain
    scraper_cron_hour: int = 0  # 00:00 SGT
    scraper_cron_timezone: str = "Asia/Singapore"


settings = Settings()
