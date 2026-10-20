from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app import listener
from app.config import settings
from app.simulator import build_ack_message


class FakeQuery:
    """Minimal SQLAlchemy-style query stub over an in-memory list."""

    def __init__(self, rows):
        self._rows = list(rows)

    def filter(self, *args, **kwargs):
        return self

    def filter_by(self, **kwargs):
        rows = [
            r
            for r in self._rows
            if all(getattr(r, k, None) == v for k, v in kwargs.items())
        ]
        return FakeQuery(rows)

    def order_by(self, *args, **kwargs):
        return self

    def all(self):
        return list(self._rows)

    def first(self):
        return self._rows[0] if self._rows else None


class FakeSession:
    """Routes query(Model) to a canned list per model class."""

    def __init__(self, data: dict):
        self._data = data

    def query(self, model):
        return FakeQuery(self._data.get(model, []))

    def close(self):
        pass


def make_insurer(insurer_id="great-eastern", agent_email="", persona="helpful"):
    return SimpleNamespace(
        id=insurer_id,
        name="Great Eastern",
        agent_email=agent_email,
        persona=persona,
    )


# --- insurer-address detection -------------------------------------------------


def test_is_insurer_address_matches_agent_email():
    insurer = make_insurer(agent_email="advisor@ge.example.com")
    session = FakeSession({listener.Insurer: [insurer]})
    assert listener.is_insurer_address("Advisor@GE.example.com", session) is insurer


def test_is_insurer_address_matches_simulated_pattern():
    insurer = make_insurer(insurer_id="great-eastern", agent_email="")
    session = FakeSession({listener.Insurer: [insurer]})
    assert (
        listener.is_insurer_address(
            "insurer-great-eastern@insurer.assura.local", session
        )
        is insurer
    )


def test_is_insurer_address_rejects_user_relay():
    insurer = make_insurer(agent_email="")
    session = FakeSession({listener.Insurer: [insurer]})
    assert listener.is_insurer_address("user-abc@relay.assura.local", session) is None


def test_is_user_relay_sender_true_for_relay_false_for_insurer():
    insurer = make_insurer(insurer_id="great-eastern", agent_email="")
    session = FakeSession({listener.Insurer: [insurer]})
    assert listener.is_user_relay_sender("user-abc@relay.assura.local", session) is True
    assert (
        listener.is_user_relay_sender(
            "insurer-great-eastern@insurer.assura.local", session
        )
        is False
    )


# --- ack generation ------------------------------------------------------------


def test_build_ack_message_has_short_ref_and_ticketed_body():
    ref, body = build_ack_message("Great Eastern")
    assert len(ref) == 6
    int(ref, 16)  # valid hex
    assert "ticketed" in body
    assert "Great Eastern" in body
    assert ref in body


def test_strip_re_prefix_avoids_double_re():
    assert listener._strip_re_prefix("Re: Quote enquiry") == "Quote enquiry"
    assert listener._strip_re_prefix("re:   Quote") == "Quote"
    assert listener._strip_re_prefix("Quote enquiry") == "Quote enquiry"


# --- dedup-set behavior --------------------------------------------------------


@pytest.mark.asyncio
async def test_poll_once_dedups_processed_ids():
    messages = [{"ID": "1", "To": [], "From": [], "Subject": "x"}]
    response = SimpleNamespace(
        raise_for_status=lambda: None,
        json=lambda: {"messages": messages},
    )
    client = SimpleNamespace(get=AsyncMock(return_value=response))
    processed: set[str] = set()

    with patch.object(listener, "handle_message", AsyncMock()) as handle:
        await listener.poll_once(client, processed)
        await listener.poll_once(client, processed)

    assert handle.await_count == 1
    assert processed == {"1"}


# --- detected outreach triggers ack + scheduled answer -------------------------


def _outreach_setup(persona="helpful", outbound_count=1):
    insurer = make_insurer(insurer_id="great-eastern", agent_email="", persona=persona)
    thread = SimpleNamespace(
        id="thread-1",
        insurer_id="great-eastern",
        insurer_name="Great Eastern",
        subject="Quote enquiry",
        status="sent",
    )
    msgs = [
        SimpleNamespace(
            id=f"m{i}",
            thread_id="thread-1",
            ordering=i,
            direction="outbound",
            from_="user-abc@relay.assura.local",
            to="insurer-great-eastern@insurer.assura.local",
            subject="Quote enquiry",
            body="hi",
            timestamp="2026-01-01T00:00:00Z",
            ai_generated=True,
            flagged=False,
            flag_reason=None,
        )
        for i in range(outbound_count)
    ]
    session = FakeSession(
        {
            listener.Insurer: [insurer],
            listener.Thread: [thread],
            listener.ThreadMessage: msgs,
        }
    )
    return session


@pytest.mark.asyncio
async def test_detected_outreach_sends_ack_and_schedules_answer():
    session = _outreach_setup(persona="helpful")
    msg = {
        "ID": "42",
        "To": [{"Address": "insurer-great-eastern@insurer.assura.local"}],
        "From": [{"Address": "user-abc@relay.assura.local"}],
        "Subject": "Quote enquiry",
    }

    send_email = AsyncMock(return_value=("<id>", "from", "to"))
    post_crm = AsyncMock()
    reply = AsyncMock(return_value={"status": "replied", "flagged": False})
    scheduled = []

    def fake_create_task(coro):
        scheduled.append(coro)
        return SimpleNamespace()

    monkey_delay = 0.0
    with (
        patch.object(listener, "get_session", return_value=session),
        patch.object(listener, "send_email", send_email),
        patch.object(listener, "post_inbound_to_crm", post_crm),
        patch.object(listener, "send_and_record_reply", reply),
        patch.object(listener.asyncio, "create_task", side_effect=fake_create_task),
        patch.object(settings, "reply_delay_seconds", monkey_delay),
    ):
        await listener.handle_message(msg)
        # Stage 1: ack sent + posted to CRM, not flagged.
        assert send_email.await_count == 1
        ack_subject = send_email.await_args.args[2]
        assert ack_subject == "Re: Quote enquiry"
        assert post_crm.await_count == 1
        assert post_crm.await_args.kwargs.get("risk_flag") is None
        ack_posted = post_crm.await_args.args[1]
        assert ack_posted["direction"] == "inbound"
        assert ack_posted["flagged"] is False
        # Stage 2 scheduled as a separate task — run it.
        assert len(scheduled) == 1
        await scheduled[0]
        reply.assert_awaited_once_with("thread-1", "great-eastern")


@pytest.mark.asyncio
async def test_ack_from_insurer_sender_is_ignored_loop_prevention():
    session = _outreach_setup()
    msg = {
        "ID": "43",
        "To": [{"Address": "user-abc@relay.assura.local"}],
        "From": [{"Address": "insurer-great-eastern@insurer.assura.local"}],
        "Subject": "Re: Quote enquiry",
    }
    send_email = AsyncMock()
    with (
        patch.object(listener, "get_session", return_value=session),
        patch.object(listener, "send_email", send_email),
    ):
        await listener.handle_message(msg)
    send_email.assert_not_awaited()


@pytest.mark.asyncio
async def test_message_with_no_matching_thread_is_skipped():
    insurer = make_insurer(insurer_id="great-eastern", agent_email="")
    session = FakeSession(
        {
            listener.Insurer: [insurer],
            listener.Thread: [],  # no threads at all
            listener.ThreadMessage: [],
        }
    )
    msg = {
        "ID": "44",
        "To": [{"Address": "insurer-great-eastern@insurer.assura.local"}],
        "From": [{"Address": "user-abc@relay.assura.local"}],
        "Subject": "Quote enquiry",
    }
    send_email = AsyncMock()
    with (
        patch.object(listener, "get_session", return_value=session),
        patch.object(listener, "send_email", send_email),
    ):
        await listener.handle_message(msg)
    send_email.assert_not_awaited()


# --- slow-persona withholding --------------------------------------------------


def test_slow_persona_withholds_until_followup():
    # Fewer than 2 outbound messages -> build_persona_reply returns None.
    session = _outreach_setup(persona="slow", outbound_count=1)
    with patch("app.simulator.get_session", return_value=session):
        from app.simulator import build_persona_reply

        assert build_persona_reply("thread-1", "great-eastern") is None


@pytest.mark.asyncio
async def test_send_and_record_reply_no_reply_for_slow_persona():
    session = _outreach_setup(persona="slow", outbound_count=1)
    send_email = AsyncMock()
    post_crm = AsyncMock()
    with (
        patch("app.simulator.get_session", return_value=session),
        patch("app.simulator.send_email", send_email),
        patch("app.simulator.post_inbound_to_crm", post_crm),
    ):
        from app.simulator import send_and_record_reply

        result = await send_and_record_reply("thread-1", "great-eastern")

    assert result["status"] == "no_reply"
    send_email.assert_not_awaited()
    post_crm.assert_not_awaited()


@pytest.mark.asyncio
async def test_slow_persona_answers_after_followup():
    # Two outbound messages -> slow persona now returns a body.
    session = _outreach_setup(persona="slow", outbound_count=2)
    send_email = AsyncMock(return_value=("<id>", "from", "to"))
    post_crm = AsyncMock()
    with (
        patch("app.simulator.get_session", return_value=session),
        patch("app.simulator.send_email", send_email),
        patch("app.simulator.post_inbound_to_crm", post_crm),
    ):
        from app.simulator import send_and_record_reply

        result = await send_and_record_reply("thread-1", "great-eastern")

    assert result["status"] == "replied"
    send_email.assert_awaited_once()
    post_crm.assert_awaited_once()
