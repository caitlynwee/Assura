"""scraper.py — HTTP endpoints for triggering and checking the scraper."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings
from app.scraper.engine import run_scraper
from app.storage.database import ScraperRun, get_session

router = APIRouter()


class TriggerRequest(BaseModel):
    source_id: str | None = None


@router.post("/run")
async def run_now(body: TriggerRequest | None = None):
    """Trigger a scrape immediately (manual 'Run now' button)."""
    source_id = body.source_id if body else None
    result = await run_scraper(trigger="manual", source_id=source_id)
    return result


@router.get("/status")
async def get_status():
    """Return the last scraper run result and next scheduled time."""
    session = get_session()
    try:
        last = (
            session.query(ScraperRun)
            .order_by(ScraperRun.started_at.desc())
            .first()
        )
        last_run = (
            {
                "runId": last.run_id,
                "trigger": last.trigger,
                "startedAt": last.started_at,
                "finishedAt": last.finished_at,
                "sourcesChecked": last.sources_checked,
                "sourcesChanged": last.sources_changed,
                "errors": last.errors,
            }
            if last
            else None
        )
    finally:
        session.close()

    return {
        "last_run": last_run,
        "scraper_available": True,
        "next_scheduled": f"Daily at {settings.scraper_cron_hour:02d}:00 SGT",
    }
