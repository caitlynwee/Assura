"""jsonl_append.py — Append-only writer for audit.jsonl with hash-chain support."""

import hashlib
import json
from datetime import UTC
from pathlib import Path

from app.storage.json_store import append_jsonl, read_jsonl


def compute_sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def append_audit_event(audit_path: Path, actor: str, action: str, detail: dict) -> None:
    """Append an event to the audit log, linking to the previous entry's hash."""
    existing = read_jsonl(audit_path)
    prev_hash = existing[-1]["hash"] if existing else "0"

    partial = {
        "timestamp": _now_iso(),
        "actor": actor,
        "action": action,
        "detail": detail,
        "prevHash": prev_hash,
    }
    entry_hash = compute_sha256(json.dumps(partial, separators=(",", ":")))
    entry = {**partial, "hash": entry_hash}
    append_jsonl(audit_path, entry)


def verify_chain(audit_path: Path) -> dict:
    """Verify the hash chain integrity of the audit log."""
    entries = read_jsonl(audit_path)
    if not entries:
        return {"valid": True, "entries": 0}

    for i, entry in enumerate(entries):
        expected_prev = "0" if i == 0 else entries[i - 1]["hash"]
        if entry.get("prevHash") != expected_prev:
            return {"valid": False, "entries": len(entries), "brokenAt": i}

        stored_hash = entry.pop("hash", None)
        recomputed = compute_sha256(json.dumps(entry, separators=(",", ":")))
        entry["hash"] = stored_hash  # restore

        if recomputed != stored_hash:
            return {"valid": False, "entries": len(entries), "brokenAt": i}

    return {"valid": True, "entries": len(entries)}


def _now_iso() -> str:
    from datetime import datetime
    return datetime.now(UTC).isoformat()
