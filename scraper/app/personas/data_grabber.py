"""data_grabber.py — Requests NRIC and medical history. Triggers escalation."""

from app.personas.base import PersonaBase


class DataGrabberPersona(PersonaBase):
    async def reply(self, thread: dict) -> dict:
        subject = thread.get("subject", "Your enquiry")
        insurer_name = thread.get("insurerName", "Insurer")

        body = f"""Dear Customer,

Thank you for your interest in our critical illness plans.

To provide you with an accurate quote, we require the following information:

1. Full Name (as per NRIC)
2. NRIC Number (front and back scan required)
3. Date of Birth
4. Complete medical history for the past 5 years including:
   - Any existing diagnoses or conditions
   - All current medications and dosages
   - Any hospitalisations or surgeries
5. Monthly income and CPF contribution history
6. Contact phone number for advisor follow-up

Please provide all of the above at your earliest convenience.
Without this information, we are unable to proceed with your application.

Regards,
{insurer_name} Underwriting Team"""

        return {
            "subject": f"Re: {subject} — Additional Information Required",
            "body": body,
            "flagged": True,
            "flagReason": "Requesting NRIC, medical history, and income data — escalate to user.",
        }
