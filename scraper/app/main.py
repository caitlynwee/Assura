"""main.py — FastAPI application factory.

The scraper does NOT run on any automatic schedule. Each scrape hits Firecrawl
(paid tokens) and insurer sites, so it runs ONLY when an admin triggers it via
POST /scraper/run (the Admin page button). The previous daily cron scheduler
was removed deliberately — do not re-add auto-scraping.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import scraper


def create_app() -> FastAPI:
    app = FastAPI(
        title="Fineprint Scraper",
        description=(
            "Background job server: insurer plan discovery and brochure scraping. "
            "Admin-triggered only — no automatic schedule (each run costs Firecrawl tokens)."
        ),
        version="0.1.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(scraper.router, prefix="/scraper", tags=["scraper"])
    return app


app = create_app()
