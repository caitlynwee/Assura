"""simulator.py — Dispatches to insurer persona and sends the reply via Mailpit."""

import httpx

from app.config import settings
from app.email_relay.relay import send_email
from app.personas.data_grabber import DataGrabberPersona
from app.personas.helpful import HelpfulPersona
from app.personas.injector import InjectorPersona
from app.personas.pushy import PushyPersona
from app.personas.slow import SlowPersona
from app.storage.database import Insurer, Thread, ThreadMessage, get_session
from app.utils.time import now_utc_iso

PERSONA_MAP = {
    "helpful": HelpfulPersona,
    "slow": SlowPersona,
    "pushy": PushyPersona,
    "data_grabber": DataGrabberPersona,
    "injector": InjectorPersona,
}


async def simulate_reply(thread_id: str, insurer_id: str) -> dict:
    """Simulate an insurer reply for the given thread."""
    session = get_session()
    try:
        thread = session.query(Thread).filter_by(id=thread_id).first()
        if not thread:
            raise ValueError(f"Thread {thread_id} not found")

        insurer = session.query(Insurer).filter_by(id=insurer_id).first()
        if not insurer:
            raise ValueError(f"Insurer {insurer_id} not found")

        # Build a thread dict that persona.reply() expects (camelCase messages list)
        messages = (
            session.query(ThreadMessage)
            .filter_by(thread_id=thread_id)
            .order_by(ThreadMessage.ordering)
            .all()
        )
        thread_dict = {
            "id": thread.id,
            "insurerId": thread.insurer_id,
            "insurerName": thread.insurer_name,
            "subject": thread.subject,
            "status": thread.status,
            "messages": [
                {
                    "id": m.id,
                    "direction": m.direction,
                    "from": m.from_,
                    "to": m.to,
                    "subject": m.subject,
                    "body": m.body,
                    "timestamp": m.timestamp,
                    "aiGenerated": m.ai_generated,
                    "flagged": m.flagged,
                    "flagReason": m.flag_reason,
                }
                for m in messages
            ],
        }

        persona_type = insurer.persona
        PersonaClass = PERSONA_MAP.get(persona_type, HelpfulPersona)
        persona = PersonaClass()

        reply = await persona.reply(thread_dict)

        # No reply from slow persona on first contact
        if reply.get("body") is None:
            return {"status": "no_reply", "reason": "Slow persona — waiting for follow-up"}

        # Send the reply email via Mailpit
        from_address = insurer.agent_email
        user_masked_inbox = (
            thread_dict["messages"][0]["from"]
            if thread_dict["messages"]
            else "user@relay.assura.local"
        )

        await send_email(
            from_address=from_address,
            to_address=user_masked_inbox,
            subject=reply["subject"],
            body=reply["body"],
        )

        # Post inbound message back to web backend (web is the sole CRM writer).
        new_message = {
            "id": f"msg_{now_utc_iso()[:19].replace(':', '-')}",
            "direction": "inbound",
            "from": from_address,
            "to": user_masked_inbox,
            "subject": reply["subject"],
            "body": reply["body"],
            "timestamp": now_utc_iso(),
            "aiGenerated": False,
            "flagged": reply.get("flagged", False),
            "flagReason": reply.get("flagReason"),
        }

        async with httpx.AsyncClient(timeout=10) as client:
            callback = await client.post(
                f"{settings.web_base_url}/api/internal/crm/replies",
                headers={"x-internal-api-key": settings.internal_api_secret},
                json={
                    "threadId": thread_id,
                    "message": new_message,
                    "riskFlag": reply.get("flagReason") if reply.get("flagged") else None,
                },
            )
            callback.raise_for_status()

    finally:
        session.close()

    return {"status": "replied", "flagged": reply.get("flagged", False)}
