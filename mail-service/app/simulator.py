from datetime import UTC, datetime
from uuid import uuid4

import httpx

from app.config import settings
from app.database import Insurer, Thread, ThreadMessage, get_session
from app.personas import generate_reply
from app.relay import send_email


async def simulate_reply(thread_id: str, insurer_id: str) -> dict:
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
            return {"status": "no_reply", "reason": "Slow persona — waiting for follow-up"}

        from_address = insurer.agent_email
        to_address = (
            thread_data["messages"][0]["from"]
            if thread_data["messages"]
            else "user@relay.assura.local"
        )
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
    finally:
        session.close()

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"{settings.web_base_url}/api/internal/crm/replies",
            headers={"x-internal-api-key": settings.internal_api_secret},
            json={
                "threadId": thread_id,
                "message": inbound,
                "riskFlag": reply["flagReason"] if reply["flagged"] else None,
            },
        )
        response.raise_for_status()

    return {"status": "replied", "flagged": reply["flagged"]}
