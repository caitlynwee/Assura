"""relay.py — Send emails via Mailpit SMTP sandbox."""

from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.config import settings

AI_DISCLOSURE = (
    "Note: This email is drafted and sent by an AI assistant (Fineprint) on behalf "
    "of a customer who has reviewed and approved it. The customer's real contact "
    "details are not shared in this message."
)


async def send_email(
    from_address: str,
    to_address: str,
    subject: str,
    body: str,
) -> str:
    """Send an email via Mailpit. Prepends AI disclosure. Returns message ID."""
    full_body = f"{AI_DISCLOSURE}\n\n{'─' * 60}\n\n{body}"

    msg = MIMEMultipart("alternative")
    msg["From"] = from_address
    msg["To"] = to_address
    msg["Subject"] = subject
    msg.attach(MIMEText(full_body, "plain", "utf-8"))

    await aiosmtplib.send(
        msg,
        hostname=settings.mailpit_smtp_host,
        port=settings.mailpit_smtp_port,
        start_tls=False,
        validate_certs=False,
    )

    return msg.get("Message-ID", "unknown")


async def check_smtp_connection() -> bool:
    try:
        smtp = aiosmtplib.SMTP(
            hostname=settings.mailpit_smtp_host,
            port=settings.mailpit_smtp_port,
        )
        await smtp.connect()
        await smtp.quit()
        return True
    except Exception:  # noqa: BLE001
        return False
