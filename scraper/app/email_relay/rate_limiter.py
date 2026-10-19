"""rate_limiter.py — Email rate limiting.

Limits:
- Max 5 insurers per outreach request
- 1 follow-up per thread per 48 hours
- 20 emails per user per day (SGT)
"""

from datetime import UTC, datetime, timedelta

MAX_INSURERS_PER_REQUEST = 5
MAX_EMAILS_PER_DAY = 20
FOLLOWUP_COOLDOWN_HOURS = 48


def check_insurer_limit(insurer_ids: list[str]) -> None:
    if len(insurer_ids) > MAX_INSURERS_PER_REQUEST:
        raise ValueError(
            f"Maximum {MAX_INSURERS_PER_REQUEST} insurers per outreach request."
        )


def check_daily_limit(user_id: str, threads: list[dict]) -> None:
    today_start = datetime.now(UTC).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    count = sum(
        1
        for thread in threads
        if thread.get("userId") == user_id
        for msg in thread.get("messages", [])
        if msg.get("direction") == "outbound"
        and datetime.fromisoformat(msg["timestamp"]) >= today_start
    )

    if count >= MAX_EMAILS_PER_DAY:
        raise ValueError(
            f"Daily email limit reached ({MAX_EMAILS_PER_DAY}/day). Try again tomorrow."
        )


def check_followup_cooldown(user_id: str, thread_id: str, threads: list[dict]) -> None:
    thread = next(
        (t for t in threads if t.get("id") == thread_id and t.get("userId") == user_id),
        None,
    )
    if not thread:
        return

    outbound = [
        m for m in thread.get("messages", []) if m.get("direction") == "outbound"
    ]
    if not outbound:
        return

    last_sent = max(datetime.fromisoformat(m["timestamp"]) for m in outbound)
    elapsed = datetime.now(UTC) - last_sent.replace(tzinfo=UTC)

    if elapsed < timedelta(hours=FOLLOWUP_COOLDOWN_HOURS):
        hours_left = int((timedelta(hours=FOLLOWUP_COOLDOWN_HOURS) - elapsed).total_seconds() / 3600) + 1
        raise ValueError(
            f"Follow-up cooldown active. You can message this insurer again in {hours_left}h."
        )
