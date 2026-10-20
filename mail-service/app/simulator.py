from datetime import UTC, datetime
from uuid import uuid4

import httpx

from app.config import settings
from app.database import Insurer, Thread, ThreadMessage, get_session
from app.personas import generate_reply
from app.relay import send_email, simulated_insurer_address


def build_ack_message(insurer_name: str) -> tuple[str, str]:
    """Build the immediate acknowledgement body and a short reference.

    Returns (ref, body) where ref is a 6-hex-char token. The ack is sent by the
    listener as stage 1, before the delayed persona answer (stage 2).
    """
    ref = uuid4().hex[:6]
    body = (
        f"Thank you for contacting {insurer_name}. Your enquiry has been received "
        f"and ticketed (ref #{ref}). An advisor will respond shortly."
    )
    return ref, body


async def post_inbound_to_crm(
    thread_id: str,
    inbound_message: dict,
    risk_flag: str | None,
) -> None:
    """POST an inbound ThreadMessage to the web internal replies callback.

    Reuses the unchanged x-internal-api-key authenticated endpoint. The web side
    sets the thread status to `flagged` when risk_flag is truthy, else `replied`.
    """
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"{settings.web_base_url}/api/internal/crm/replies",
            headers={"x-internal-api-key": settings.internal_api_secret},
            json={
                "threadId": thread_id,
                "message": inbound_message,
                "riskFlag": risk_flag,
            },
        )
        response.raise_for_status()


def build_persona_reply(thread_id: str, insurer_id: str) -> dict | None:
    """Load the thread/insurer and run the persona logic.

    Returns a dict with the resolved from/to addresses and the persona `reply`
    (subject/body/flagged/flagReason), or None when the persona withholds a body
    (the slow persona returns body=None until there are >= 2 outbound messages).
    """
    session = get_session()
    try:
        thread = session.query(Thread).filter_by(id=thread_id).first()
        insurer = session.query(Insurer).filter_by(id=insurer_id).first()
        if not thread or not insurer:
            raise LookupError("Thread or insurer not found")
        if thread.insurer_id != insurer.id:
            raise ValueError("Insurer does not match thread")

        messages = (
            session.query(ThreadMessage)
            .filter_by(thread_id=thread_id)
            .order_by(ThreadMessage.ordering)
            .all()
        )
        thread_data = {
            "id": thread.id,
            "insurerId": thread.insurer_id,
            "insurerName": thread.insurer_name,
            "subject": thread.subject,
            "status": thread.status,
            "messages": [
                {
                    "direction": message.direction,
                    "from": message.from_,
                    "to": message.to,
                    "subject": message.subject,
                    "body": message.body,
                    "timestamp": message.timestamp,
                    "aiGenerated": message.ai_generated,
                    "flagged": message.flagged,
                    "flagReason": message.flag_reason,
                }
                for message in messages
            ],
        }
        reply = generate_reply(thread_data, insurer.persona)
        if reply["body"] is None:
            return None

        from_address = insurer.agent_email.strip() or simulated_insurer_address(insurer.id)
        to_address = (
            thread_data["messages"][0]["from"]
            if thread_data["messages"]
            else "user@relay.assura.local"
        )
        return {
            "from_address": from_address,
            "to_address": to_address,
            "reply": reply,
        }
    finally:
        session.close()


async def send_and_record_reply(thread_id: str, insurer_id: str) -> dict:
    """Send the substantive persona answer and record it in the CRM.

    Returns {"status": "no_reply", ...} when the persona withholds (slow persona
    before a follow-up); otherwise sends the email, posts the inbound message to
    the CRM and returns {"status": "replied", "flagged": ...}.
    """
    built = build_persona_reply(thread_id, insurer_id)
    if built is None:
        return {"status": "no_reply", "reason": "Slow persona — waiting for follow-up"}

    from_address = built["from_address"]
    to_address = built["to_address"]
    reply = built["reply"]

    await send_email(from_address, to_address, reply["subject"], reply["body"])
    inbound = {
        "id": f"msg_{uuid4()}",
        "direction": "inbound",
        "from": from_address,
        "to": to_address,
        "subject": reply["subject"],
        "body": reply["body"],
        "timestamp": datetime.now(UTC).isoformat(),
        "aiGenerated": False,
        "flagged": reply["flagged"],
        "flagReason": reply["flagReason"],
    }
    await post_inbound_to_crm(
        thread_id,
        inbound,
        reply["flagReason"] if reply["flagged"] else None,
    )
    return {"status": "replied", "flagged": reply["flagged"]}
