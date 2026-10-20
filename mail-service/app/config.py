from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = ""
    web_base_url: str = "http://localhost:3000"
    internal_api_secret: str = "dev-internal-key"
    mailpit_smtp_host: str = "localhost"
    mailpit_smtp_port: int = 1025
    # Mailpit HTTP API base. Empty = derive at runtime from mailpit_smtp_host on
    # port 8025 (e.g. http://mailpit:8025 in Docker / http://localhost:8025 locally).
    mailpit_api_base: str = ""
    # Background reply listener tuning (demo-fast defaults).
    listener_enabled: bool = True
    listener_poll_seconds: float = 3.0
    reply_delay_seconds: float = 6.0

    def mailpit_api_base_url(self) -> str:
        if self.mailpit_api_base:
            return self.mailpit_api_base.rstrip("/")
        return f"http://{self.mailpit_smtp_host}:8025"


settings = Settings()
