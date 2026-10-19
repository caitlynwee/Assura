"""scraper.py — HTTP endpoints for triggering and checking the scraper."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings
from app.scraper.engine import run_scraper
from app.storage.json_store import read_jsonl

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
    runs = read_jsonl(settings.data_dir / "scraper_runs.jsonl")
    last_run = runs[-1] if runs else None
    return {
        "last_run": last_run,
        "scraper_available": True,
        "next_scheduled": f"Daily at {settings.scraper_cron_hour:02d}:00 SGT",
    }
