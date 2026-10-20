"""debug_dump.py — Write raw API responses to scraper/app/debug/ for inspection.

Files land at ./scraper/app/debug/<tag>_<timestamp>.json on the host
(the scraper/app directory is bind-mounted into Docker at /app/app).
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path

DEBUG_DIR = Path(__file__).parent.parent / "debug"


def dump(tag: str, data: object) -> None:
    """Write *data* as JSON to debug/<tag>_<iso-timestamp>.json.

    Silently skips if DEBUG_SCRAPER env var is not set.
    """
    if not os.environ.get("DEBUG_SCRAPER"):
        return
    try:
        DEBUG_DIR.mkdir(exist_ok=True)
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
        path = DEBUG_DIR / f"{tag}_{ts}.json"
        with path.open("w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2, default=str)
        print(f"[debug_dump] wrote {path.name}")
    except Exception as exc:  # noqa: BLE001
        print(f"[debug_dump] failed to write {tag}: {exc}")
