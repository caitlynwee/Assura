"""relay.py — Send emails via Mailpit SMTP sandbox."""

from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.config import settings

# Brief, unobtrusive transparency footer. The body itself is written in the
# customer's first-person voice (they are representing themselves); this single
# line keeps the required AI-assistance disclosure without framing the whole
# message as "on behalf of" a third party.
AI_DISCLOSURE = (
    "— Sent with the help of Assura, a personal insurance assistant, "
    "and reviewed and approved by me before sending."
)


async def send_email(
    from_address: str,
    to_address: str,
    subject: str,
    body: str,
) -> str:
    """Send an email. Uses real SMTP (auth + STARTTLS) when settings.smtp_host
    is configured, otherwise the local Mailpit sandbox. Prepends AI disclosure.
    Returns the message ID."""
    # Disclosure as a short footer (not a leading block) so the email reads as
    # the customer speaking directly, with transparency preserved at the end.
    full_body = f"{body}\n\n{'─' * 40}\n{AI_DISCLOSURE}"

    use_real_smtp = bool(settings.smtp_host)

    msg = MIMEMultipart("alternative")
    msg["To"] = to_address
    msg["Subject"] = subject

    if use_real_smtp:
        # Real providers (e.g. Gmail) reject arbitrary From addresses and rewrite
        # From to the authenticated account. Keep the masked relay address as the
        # Reply-To so the privacy intent holds and replies route back correctly.
        sender = settings.smtp_from or settings.smtp_username
        msg["From"] = sender
        msg["Reply-To"] = from_address
    else:
        msg["From"] = from_address

    msg.attach(MIMEText(full_body, "plain", "utf-8"))

    if use_real_smtp:
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            start_tls=True,
            username=settings.smtp_username,
            password=settings.smtp_password,
        )
    else:
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
