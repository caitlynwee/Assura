from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.relay import require_mailpit_destination, send_email


@pytest.mark.asyncio
async def test_email_is_delivered_to_configured_mailpit_only(monkeypatch):
    monkeypatch.setattr(settings, "mailpit_smtp_host", "mailpit")
    monkeypatch.setattr(settings, "mailpit_smtp_port", 1025)
    smtp_send = AsyncMock()

    with patch("app.relay.aiosmtplib.send", smtp_send):
        message_id, sender, recipient = await send_email(
            "user@relay.assura.local",
            "advisor@example.com",
            "Quote enquiry",
            "Please share plan details.",
        )

    assert smtp_send.await_args.kwargs["hostname"] == "mailpit"
    assert smtp_send.await_args.kwargs["port"] == 1025
    assert sender == "user@relay.assura.local"
    assert recipient == "advisor@example.com"
    assert message_id == smtp_send.await_args.args[0]["Message-ID"]
    content = smtp_send.await_args.args[0].get_payload()[0].get_payload(decode=True).decode()
    assert "reviewed and approved by me before sending" in content


def test_external_smtp_destination_is_rejected(monkeypatch):
    monkeypatch.setattr(settings, "mailpit_smtp_host", "smtp.example.com")
    monkeypatch.setattr(settings, "mailpit_smtp_port", 587)

    with pytest.raises(RuntimeError, match="restricted to local Mailpit"):
        require_mailpit_destination()


def test_mail_routes_require_internal_api_key():
    settings.internal_api_secret = "test-secret"
    client = TestClient(app)

    response = client.post(
        "/email/send",
        json={
            "from_address": "user@relay.assura.local",
            "to_address": "advisor@example.com",
            "subject": "Question",
            "body": "Please send details.",
        },
    )

    assert response.status_code == 403
