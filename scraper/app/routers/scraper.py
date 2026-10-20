"""scraper.py — HTTP endpoints for triggering and checking the scraper."""

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.scraper.engine import run_scraper
from app.storage.database import ScraperRun, get_session

router = APIRouter()


class TriggerRequest(BaseModel):
    source_id: str | None = None


def require_internal_api_key(api_key: str | None) -> None:
    if api_key != settings.internal_api_secret:
        raise HTTPException(status_code=401, detail="Invalid internal API key")


@router.post("/run")
async def run_now(
    body: TriggerRequest | None = None,
    x_internal_api_key: str | None = Header(default=None),
):
    """Trigger a scrape immediately (manual 'Run now' button)."""
    require_internal_api_key(x_internal_api_key)
    source_id = body.source_id if body else None
    result = await run_scraper(trigger="manual", source_id=source_id)
    return result


@router.get("/status")
async def get_status(x_internal_api_key: str | None = Header(default=None)):
    """Return the last scraper run result and next scheduled time."""
    require_internal_api_key(x_internal_api_key)
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
        # No automatic schedule — the scraper only runs when an admin triggers it
        # (each run costs Firecrawl tokens).
        "next_scheduled": "Manual only (admin-triggered)",
    }
