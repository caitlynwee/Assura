"""helpful.py — Replies with a full, detailed quote immediately."""

from app.personas.base import PersonaBase


class HelpfulPersona(PersonaBase):
    async def reply(self, thread: dict) -> dict:
        insurer_name = thread.get("insurerName", "Insurer")
        subject = thread.get("subject", "Your enquiry")

        body = f"""Dear Customer,

Thank you for your enquiry about our critical illness insurance plans.

Based on your profile, here is a personalised quote:

Plan: {insurer_name} CriticalCare Premier
Coverage Amount: SGD 200,000
Annual Premium (non-smoker, age 30): SGD 1,200/year
Annual Premium (non-smoker, age 40): SGD 2,100/year

Key Highlights:
- Covers 37 critical illnesses including early-stage conditions
- 100% lump sum payout upon diagnosis
- Waiver of future premiums upon any claim

Waiting Period: 90 days for most conditions
Quote Validity: 30 days from date of this email

Please do not hesitate to reach out if you have further questions.

Warm regards,
{insurer_name} Advisory Team"""

        return {
            "subject": f"Re: {subject}",
            "body": body,
            "flagged": False,
            "flagReason": None,
        }
