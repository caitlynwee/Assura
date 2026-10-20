from fastapi import FastAPI

from app.routers import email

app = FastAPI(
    title="Assura Mail Service",
    description="Premium outreach delivery to Mailpit and simulated insurer replies.",
    version="0.1.0",
)
app.include_router(email.router, prefix="/email", tags=["email"])
