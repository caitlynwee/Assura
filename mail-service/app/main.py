import asyncio
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.listener import run_listener
from app.routers import email


@asynccontextmanager
async def lifespan(app: FastAPI):
    task: asyncio.Task | None = None
    if settings.listener_enabled:
        task = asyncio.create_task(run_listener())
    try:
        yield
    finally:
        if task is not None:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task


app = FastAPI(
    title="Assura Mail Service",
    description="Premium outreach delivery to Mailpit and simulated insurer replies.",
    version="0.1.0",
    lifespan=lifespan,
)
app.include_router(email.router, prefix="/email", tags=["email"])
