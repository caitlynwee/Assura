"""pushy.py — Uses high-pressure sales tactics. Flagged by the CRM."""

from app.personas.base import PersonaBase


class PushyPersona(PersonaBase):
    async def reply(self, thread: dict) -> dict:
        subject = thread.get("subject", "Your enquiry")
        insurer_name = thread.get("insurerName", "Insurer")

        body = f"""Dear Valued Customer,

URGENT: LIMITED TIME OFFER — Act before this week ends!

Our most popular critical illness plan is currently available at a SPECIAL PROMOTIONAL RATE.
This offer EXPIRES in 48 hours.

To lock in your rate TODAY, simply sign the attached application form and return it to us.
Don't miss this chance — premiums are increasing next month!

Our advisor will call you shortly to finalise the paperwork.
Please ensure your phone is available between 9am–6pm.

ACT NOW before it's too late!

{insurer_name} Sales Team
"Your future self will thank you — Sign today!" """

        return {
            "subject": f"URGENT: Re: {subject} — Limited Offer Expiring Soon!",
            "body": body,
            "flagged": True,
            "flagReason": "High-pressure sales tactics detected. Pressure to sign immediately.",
        }
