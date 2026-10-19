"""Tests for the hash-chain audit log."""

import json
from pathlib import Path

from app.storage.jsonl_append import append_audit_event, verify_chain


def test_empty_chain_is_valid(tmp_path):
    audit = tmp_path / "audit.jsonl"
    audit.write_text("")
    result = verify_chain(audit)
    assert result["valid"] is True
    assert result["entries"] == 0


def test_chain_builds_and_verifies(tmp_path):
    audit = tmp_path / "audit.jsonl"
    audit.write_text("")

    append_audit_event(audit, "user_1", "test.action", {"val": 1})
    append_audit_event(audit, "user_1", "test.action", {"val": 2})
    append_audit_event(audit, "user_1", "test.action", {"val": 3})

    result = verify_chain(audit)
    assert result["valid"] is True
    assert result["entries"] == 3


def test_tampered_chain_is_detected(tmp_path):
    audit = tmp_path / "audit.jsonl"
    audit.write_text("")

    append_audit_event(audit, "user_1", "original.action", {"detail": "ok"})

    # Tamper: modify the action but keep the original hash
    raw = audit.read_text().strip()
    entry = json.loads(raw)
    entry["action"] = "tampered.action"
    audit.write_text(json.dumps(entry) + "\n")

    result = verify_chain(audit)
    assert result["valid"] is False
    assert result["brokenAt"] == 0


def test_first_entry_prev_hash_is_zero(tmp_path):
    audit = tmp_path / "audit.jsonl"
    audit.write_text("")
    append_audit_event(audit, "user_1", "first.action", {})

    entries = [json.loads(line) for line in audit.read_text().strip().splitlines()]
    assert entries[0]["prevHash"] == "0"
