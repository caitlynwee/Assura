"""main.py — FastAPI application factory with lifespan scheduler."""

from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import email, scraper


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start cron scheduler — runs scraper daily at 00:00 SGT
    scheduler = AsyncIOScheduler(timezone=settings.scraper_cron_timezone)
    scheduler.add_job(
        _run_scheduled_scrape,
        trigger="cron",
        hour=settings.scraper_cron_hour,
        minute=0,
        id="daily_scrape",
        replace_existing=True,
    )
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


async def _run_scheduled_scrape() -> None:
    from app.scraper.engine import run_scraper
    await run_scraper(trigger="cron")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Fineprint Scraper",
        description="Background job server: web scraper, email relay, insurer reply simulator",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(scraper.router, prefix="/scraper", tags=["scraper"])
    app.include_router(email.router, prefix="/email", tags=["email"])

    return app


app = create_app()
