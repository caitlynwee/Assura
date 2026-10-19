from pydantic import BaseModel


class ScraperError(BaseModel):
    source_id: str
    message: str


class ScraperRun(BaseModel):
    run_id: str
    trigger: str  # "cron" | "manual"
    started_at: str
    finished_at: str
    sources_checked: int
    sources_changed: int
    errors: list[ScraperError] = []
