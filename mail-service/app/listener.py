"""Background Mailpit poller that auto-replies to outreach emails.

The listener watches the Mailpit sandbox inbox. When it sees an outreach email
addressed TO an insurer (and sent FROM a user relay address), it auto-replies in
two stages: an immediate "ticketed" acknowledgement, then a delayed persona
answer produced by the existing persona logic.

Loop prevention is critical: acks/answers are sent FROM an insurer address, so
the listener reacts only to messages whose recipient is an insurer address AND
whose sender is NOT an insurer address. An in-memory processed-ID set guarantees
each inbound Mailpit message is handled exactly once.
"""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import UTC, datetime
from uuid import uuid4

import httpx

from app.config import settings
from app.database import Insurer, Thread, ThreadMessage, get_session
from app.relay import send_email, simulated_insurer_address
from app.simulator import build_ack_message, post_inbound_to_crm, send_and_record_reply

logger = logging.getLogger(__name__)

_SIMULATED_SUFFIX = "@insurer.assura.local"
_SIMULATED_RE = re.compile(r"^insurer-(?P<slug>[a-z0-9-]+)@insurer\.assura\.local$")


def _normalise_address(value) -> str:
    """Normalise a Mailpit To/From field to a bare address string.

    Mailpit returns To/From as arrays of {Address, Name}; handle both the array
    and a plain-string shape defensively. Returns the first address found.
    """
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        return str(value.get("Address", "")).strip()
    if isinstance(value, list):
        for item in value:
            addr = _normalise_address(item)
            if addr:
                return addr
    return ""


def _insurer_slug(insurer_id: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", insurer_id.lower()).strip("-")


def is_insurer_address(addr: str, session) -> Insurer | None:
    """Return the Insurer an address belongs to, or None.

    Matches either a configured agent_email (case-insensitive, trimmed) or the
    simulated `insurer-<slug>@insurer.assura.local` pattern whose slug maps back
    to a known insurer id (same slug rule as relay.simulated_insurer_address).
    """
    addr = (addr or "").strip().lower()
    if not addr:
        return None

    insurers = session.query(Insurer).all()

    # Match a configured agent email directly.
    for insurer in insurers:
        agent = (insurer.agent_email or "").strip().lower()
        if agent and agent == addr:
            return insurer

    # Match the simulated insurer-<slug>@insurer.assura.local pattern.
    match = _SIMULATED_RE.match(addr)
    if match:
        slug = match.group("slug")
        for insurer in insurers:
            if _insurer_slug(insurer.id) == slug:
                return insurer
    return None


def is_user_relay_sender(addr: str, session) -> bool:
    """True when the sender is a user relay address (NOT an insurer address).

    The decisive loop-prevention rule: react only when the recipient is an
    insurer address AND the sender is a user relay address. Acks/answers sent by
    this service originate FROM an insurer address, so they are excluded here.
    """
    addr = (addr or "").strip().lower()
    if not addr:
        return False
    if addr.endswith(_SIMULATED_SUFFIX):
        return False
    return is_insurer_address(addr, session) is None


def _strip_re_prefix(subject: str) -> str:
    """Remove a single leading 'Re: ' (case-insensitive) to avoid 'Re: Re:'."""
    return re.sub(r"^\s*re:\s*", "", subject or "", flags=re.IGNORECASE)


def find_thread_for_inbound(session, insurer: Insurer, subject: str) -> Thread | None:
    """Map an inbound Mailpit message back to a CRM thread.

    Matching heuristic (documented):
      1. Restrict to non-closed threads for this insurer.
      2. Prefer a thread whose latest outbound message subject matches the
         inbound subject, comparing with any leading 'Re: ' stripped.
      3. "Most recently updated" is approximated by the latest ThreadMessage
         ordering across the thread's messages, because the Thread model has no
         updated_at column. Among subject matches, pick the one with the highest
         latest-ordering; if none match on subject, fall back to the most-recent
         non-closed thread for this insurer. Return None if nothing qualifies.
    """
    threads = (
        session.query(Thread)
        .filter(Thread.insurer_id == insurer.id, Thread.status != "closed")
        .all()
    )
    if not threads:
        return None

    target = _strip_re_prefix(subject).strip().lower()

    def latest_ordering(thread: Thread) -> int:
        orderings = [
            m.ordering
            for m in session.query(ThreadMessage)
            .filter(ThreadMessage.thread_id == thread.id)
            .all()
        ]
        return max(orderings) if orderings else -1

    def latest_outbound_subject(thread: Thread) -> str:
        outbound = (
            session.query(ThreadMessage)
            .filter(
                ThreadMessage.thread_id == thread.id,
                ThreadMessage.direction == "outbound",
            )
            .order_by(ThreadMessage.ordering.desc())
            .first()
        )
        return _strip_re_prefix(outbound.subject).strip().lower() if outbound else ""

    subject_matches = [t for t in threads if target and latest_outbound_subject(t) == target]
    if subject_matches:
        return max(subject_matches, key=latest_ordering)

    # Fallback: most recently updated non-closed thread for this insurer.
    return max(threads, key=latest_ordering)


async def handle_message(msg: dict) -> None:
    """Handle a single Mailpit message summary ({ID, To, From, Subject}).

    Resolves recipient -> insurer and sender -> user relay; skips anything that
    is not an outreach email or cannot be mapped to a thread. Then runs the
    two-stage reply flow (immediate ack + delayed persona answer).
    """
    recipient = _normalise_address(msg.get("To"))
    sender = _normalise_address(msg.get("From"))
    subject = msg.get("Subject") or ""

    session = get_session()
    try:
        insurer = is_insurer_address(recipient, session)
        if insurer is None:
            # Not addressed to an insurer (e.g. an ack/answer we sent) — skip.
            logger.debug("Skipping message to non-insurer recipient: %s", recipient)
            return
        if not is_user_relay_sender(sender, session):
            # Loop prevention: sender is an insurer address, so this is our own
            # outbound ack/answer — never react to it.
            logger.debug("Skipping message from non-user-relay sender: %s", sender)
            return

        thread = find_thread_for_inbound(session, insurer, subject)
        if thread is None:
            logger.info(
                "No open thread matched inbound mail for insurer %s (subject=%r) — skipping",
                insurer.id,
                subject,
            )
            return

        thread_id = thread.id
        insurer_id = insurer.id
        insurer_name = insurer.name
        from_address = (insurer.agent_email or "").strip() or simulated_insurer_address(
            insurer.id
        )
    finally:
        session.close()

    # STAGE 1 — immediate acknowledgement, FROM the insurer TO the user relay.
    ack_subject = f"Re: {_strip_re_prefix(subject)}".rstrip()
    _ref, ack_body = build_ack_message(insurer_name)
    await send_email(from_address, sender, ack_subject, ack_body)
    ack_inbound = {
        "id": f"msg_{uuid4()}",
        "direction": "inbound",
        "from": from_address,
        "to": sender,
        "subject": ack_subject,
        "body": ack_body,
        "timestamp": datetime.now(UTC).isoformat(),
        "aiGenerated": False,
        "flagged": False,
        "flagReason": None,
    }
    await post_inbound_to_crm(thread_id, ack_inbound, risk_flag=None)

    # STAGE 2 — delayed persona answer, scheduled as a separate task so the
    # poller is never blocked. The slow persona may withhold (no_reply).
    asyncio.create_task(_delayed_persona_reply(thread_id, insurer_id))


async def _delayed_persona_reply(thread_id: str, insurer_id: str) -> None:
    try:
        await asyncio.sleep(settings.reply_delay_seconds)
        await send_and_record_reply(thread_id, insurer_id)
    except Exception:  # a failed reply must never crash the loop.
        logger.exception("Delayed persona reply failed for thread %s", thread_id)


async def poll_once(client: httpx.AsyncClient, processed: set[str]) -> None:
    """Fetch the Mailpit inbox once and handle any unseen messages.

    Each message ID is added to `processed` BEFORE handling so a message is
    handled exactly once even if handling raises. Per-message errors are logged
    and skipped so one bad message never stops the poll.
    """
    url = f"{settings.mailpit_api_base_url()}/api/v1/messages"
    response = await client.get(url)
    response.raise_for_status()
    data = response.json()
    messages = data.get("messages", data) if isinstance(data, dict) else data
    for msg in messages or []:
        msg_id = str(msg.get("ID", ""))
        if not msg_id or msg_id in processed:
            continue
        processed.add(msg_id)
        try:
            await handle_message(msg)
        except Exception:  # isolate per-message failures.
            logger.exception("Failed to handle Mailpit message %s", msg_id)


async def run_listener() -> None:
    """Long-lived poll loop. Resilient: never raises out of the loop."""
    processed: set[str] = set()
    logger.info(
        "Mailpit reply listener started (api=%s, poll=%ss, reply_delay=%ss)",
        settings.mailpit_api_base_url(),
        settings.listener_poll_seconds,
        settings.reply_delay_seconds,
    )
    async with httpx.AsyncClient(timeout=10) as client:
        while True:
            try:
                await poll_once(client, processed)
            except Exception:  # Mailpit unreachable etc; keep polling.
                logger.exception("Mailpit poll iteration failed; will retry")
            await asyncio.sleep(settings.listener_poll_seconds)
