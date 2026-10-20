from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = ""
    web_base_url: str = "http://localhost:3000"
    internal_api_secret: str = "dev-internal-key"
    mailpit_smtp_host: str = "localhost"
    mailpit_smtp_port: int = 1025


settings = Settings()
