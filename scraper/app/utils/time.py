import zoneinfo
from datetime import UTC, datetime

SGT = zoneinfo.ZoneInfo("Asia/Singapore")


def now_utc_iso() -> str:
    return datetime.now(UTC).isoformat()


def now_sgt() -> datetime:
    return datetime.now(SGT)


def today_sgt_str() -> str:
    return now_sgt().strftime("%Y-%m-%d")
