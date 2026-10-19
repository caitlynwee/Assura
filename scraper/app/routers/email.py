"""email.py — HTTP endpoints for sending emails and triggering insurer replies."""

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.email_relay.relay import send_email
from app.personas.simulator import simulate_reply

router = APIRouter()


class SendRequest(BaseModel):
    from_address: str
    to_address: str
    subject: str
    body: str
    thread_id: str | None = None
    user_id: str


class ReplyRequest(BaseModel):
    thread_id: str
    insurer_id: str


def _require_internal_key(api_key: str | None) -> None:
    if api_key != settings.internal_api_secret:
        raise HTTPException(status_code=403, detail="Invalid internal API key")


@router.post("/send")
async def send_outreach_email(
    body: SendRequest,
    x_internal_api_key: str | None = Header(default=None),
):
    """Send an approved outreach email via Mailpit."""
    _require_internal_key(x_internal_api_key)
    message_id = await send_email(
        from_address=body.from_address,
        to_address=body.to_address,
        subject=body.subject,
        body=body.body,
    )
    return {"message_id": message_id, "status": "sent"}


@router.post("/reply")
async def trigger_reply(
    body: ReplyRequest,
    x_internal_api_key: str | None = Header(default=None),
):
    """Trigger a simulated insurer reply (for demo purposes)."""
    _require_internal_key(x_internal_api_key)
    result = await simulate_reply(
        thread_id=body.thread_id,
        insurer_id=body.insurer_id,
    )
    return result


@router.get("/health")
async def health_check():
    """Check Mailpit SMTP connectivity."""
    from app.email_relay.relay import check_smtp_connection
    ok = await check_smtp_connection()
    if not ok:
        raise HTTPException(status_code=503, detail="Mailpit SMTP unreachable")
    return {"status": "ok"}
