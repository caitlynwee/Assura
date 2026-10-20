import re
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import make_msgid

import aiosmtplib

from app.config import settings

AI_DISCLOSURE = (
    "— Sent with the help of Assura, a personal insurance assistant, "
    "and reviewed and approved by me before sending."
)

MAILPIT_HOSTS = {"mailpit", "localhost", "127.0.0.1"}


def simulated_insurer_address(insurer_id: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", insurer_id.lower()).strip("-")
    if not slug:
        raise ValueError("Cannot create a simulated email address for this insurer.")
    return f"insurer-{slug}@insurer.assura.local"


def require_mailpit_destination() -> None:
    if (
        settings.mailpit_smtp_host not in MAILPIT_HOSTS
        or settings.mailpit_smtp_port != 1025
    ):
        raise RuntimeError("Mail delivery is restricted to local Mailpit on port 1025.")


async def send_email(
    from_address: str,
    to_address: str,
    subject: str,
    body: str,
) -> tuple[str, str, str]:
    require_mailpit_destination()
    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["Message-ID"] = make_msgid()
    message["To"] = to_address
    message["From"] = from_address
    message.attach(MIMEText(f"{body}\n\n{'─' * 40}\n{AI_DISCLOSURE}", "plain", "utf-8"))

    await aiosmtplib.send(
        message,
        hostname=settings.mailpit_smtp_host,
        port=settings.mailpit_smtp_port,
        start_tls=False,
        validate_certs=False,
    )
    return message["Message-ID"], message["From"], to_address


async def check_smtp_connection() -> bool:
    require_mailpit_destination()
    smtp = aiosmtplib.SMTP(
        hostname=settings.mailpit_smtp_host,
        port=settings.mailpit_smtp_port,
    )
    try:
        await smtp.connect()
        await smtp.quit()
        return True
    except (OSError, aiosmtplib.errors.SMTPException):
        return False
