"""slow.py — Only replies after a follow-up has been sent."""

from app.personas.base import PersonaBase


class SlowPersona(PersonaBase):
    async def reply(self, thread: dict) -> dict:
        messages = thread.get("messages", [])
        outbound_count = sum(1 for m in messages if m.get("direction") == "outbound")

        if outbound_count < 2:
            # No reply until a follow-up has been sent
            return {"subject": None, "body": None, "flagged": False, "flagReason": None}

        subject = thread.get("subject", "Your enquiry")
        insurer_name = thread.get("insurerName", "Insurer")

        body = f"""Dear Customer,

Apologies for the delayed response. We have been reviewing your enquiry.

Thank you for your patience and for following up. Here are the details you requested:

Our standard critical illness plan starts from SGD 800/year for SGD 100,000 coverage.
A full personalised quote will require a brief phone consultation with our advisor.

Please reply to arrange a suitable time.

Best regards,
{insurer_name} Advisory Team"""

        return {
            "subject": f"Re: {subject}",
            "body": body,
            "flagged": False,
            "flagReason": None,
        }
