"""relay.py — Send emails via Mailpit SMTP sandbox."""

from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import make_msgid

import aiosmtplib

from app.config import settings

AI_DISCLOSURE = (
    "— Sent with the help of Assura, a personal insurance assistant, "
    "and reviewed and approved by me before sending."
)


async def send_email(
    from_address: str,
    to_address: str,
    subject: str,
    body: str,
) -> tuple[str, str, str]:
    """Send an email through local Mailpit and return its ID, sender, and recipient."""
    full_body = f"{body}\n\n{'─' * 40}\n{AI_DISCLOSURE}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["Message-ID"] = make_msgid()
    msg["To"] = to_address
    msg["From"] = from_address
    msg.attach(MIMEText(full_body, "plain", "utf-8"))

    await aiosmtplib.send(
        msg,
        hostname=settings.mailpit_smtp_host,
        port=settings.mailpit_smtp_port,
        start_tls=False,
        validate_certs=False,
    )

    return msg.get("Message-ID", "unknown"), msg["From"], to_address


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
