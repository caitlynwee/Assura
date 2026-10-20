from unittest.mock import AsyncMock, patch

import pytest

from app.config import settings
from app.email_relay.relay import send_email


@pytest.mark.asyncio
async def test_email_always_uses_local_mailpit_even_if_legacy_smtp_vars_are_set(
    monkeypatch,
):
    monkeypatch.setenv("SMTP_HOST", "smtp-relay.brevo.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USERNAME", "external-login")
    monkeypatch.setenv("SMTP_PASSWORD", "external-password")
    monkeypatch.setenv("SMTP_FROM", "external@example.com")
    monkeypatch.setenv("DEMO_OUTREACH_TO", "external-recipient@example.com")
    monkeypatch.setattr(settings, "mailpit_smtp_host", "mailpit")
    monkeypatch.setattr(settings, "mailpit_smtp_port", 1025)
    smtp_send = AsyncMock()

    with patch("app.email_relay.relay.aiosmtplib.send", smtp_send):
        message_id, sender, recipient = await send_email(
            from_address="user-test@relay.assura.local",
            to_address="advisor@demo.fineprint.local",
            subject="Quote enquiry",
            body="Please send the plan details.",
        )

    message = smtp_send.await_args.args[0]
    assert smtp_send.await_args.kwargs == {
        "hostname": "mailpit",
        "port": 1025,
        "start_tls": False,
        "validate_certs": False,
    }
    assert message["From"] == "user-test@relay.assura.local"
    assert message["To"] == "advisor@demo.fineprint.local"
    assert sender == "user-test@relay.assura.local"
    assert recipient == "advisor@demo.fineprint.local"
    assert message_id == message["Message-ID"]
    text_part = next(part for part in message.walk() if part.get_content_type() == "text/plain")
    assert "reviewed and approved by me before sending" in text_part.get_payload(decode=True).decode()
    smtp_send.assert_awaited_once()
