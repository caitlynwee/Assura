from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.relay import check_smtp_connection, send_email
from app.simulator import simulate_reply

router = APIRouter()


class SendRequest(BaseModel):
    from_address: str
    to_address: str
    subject: str
    body: str


class ReplyRequest(BaseModel):
    thread_id: str
    insurer_id: str


def require_internal_key(api_key: str | None) -> None:
    if not settings.internal_api_secret or api_key != settings.internal_api_secret:
        raise HTTPException(status_code=403, detail="Invalid internal API key")


@router.post("/send")
async def send_outreach_email(
    body: SendRequest,
    x_internal_api_key: str | None = Header(default=None),
):
    require_internal_key(x_internal_api_key)
    message_id, from_address, to_address = await send_email(
        body.from_address,
        body.to_address,
        body.subject,
        body.body,
    )
    return {
        "message_id": message_id,
        "from_address": from_address,
        "to_address": to_address,
        "status": "sent",
    }


@router.post("/reply")
async def trigger_reply(
    body: ReplyRequest,
    x_internal_api_key: str | None = Header(default=None),
):
    require_internal_key(x_internal_api_key)
    try:
        return await simulate_reply(body.thread_id, body.insurer_id)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/health")
async def health_check():
    if not await check_smtp_connection():
        raise HTTPException(status_code=503, detail="Local Mailpit SMTP is unreachable.")
    return {"status": "ok"}
