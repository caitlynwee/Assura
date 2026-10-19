"""simulator.py — Dispatches to insurer persona and sends the reply via Mailpit."""

import httpx

from app.config import settings
from app.email_relay.relay import send_email
from app.personas.data_grabber import DataGrabberPersona
from app.personas.helpful import HelpfulPersona
from app.personas.injector import InjectorPersona
from app.personas.pushy import PushyPersona
from app.personas.slow import SlowPersona
from app.storage.json_store import read_json
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
    insurers_path = settings.data_dir / "insurers.json"

    threads = read_json(threads_path)
    insurers = read_json(insurers_path)

    thread = next((t for t in threads if t.get("id") == thread_id), None)
    if not thread:
        raise ValueError(f"Thread {thread_id} not found")

    insurer = next((i for i in insurers if i.get("id") == insurer_id), None)
    if not insurer:
        raise ValueError(f"Insurer {insurer_id} not found")

    persona_type = insurer.get("persona", "helpful")
    PersonaClass = PERSONA_MAP.get(persona_type, HelpfulPersona)
    persona = PersonaClass()

    reply = await persona.reply(thread)

    # No reply from slow persona on first contact
    if reply.get("body") is None:
        return {"status": "no_reply", "reason": "Slow persona — waiting for follow-up"}

    # Send the reply email
    from_address = insurer.get("agentEmail", f"agent@{insurer_id}.fineprint.local")
    user_masked_inbox = thread.get("messages", [{}])[0].get("from", "user@relay.fineprint.local")

    await send_email(
        from_address=from_address,
        to_address=user_masked_inbox,
        subject=reply["subject"],
        body=reply["body"],
    )

    # Add inbound message to thread
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

    return {"status": "replied", "flagged": reply.get("flagged", False)}
