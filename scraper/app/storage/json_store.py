"""json_store.py — Atomic JSON read/write and JSONL append for shared data files."""

import json
import os
from pathlib import Path
from typing import Any


def read_json(path: Path) -> Any:
    """Read and parse a JSON file."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: Any) -> None:
    """Atomically write JSON (write to .tmp, then rename)."""
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)  # atomic on POSIX


def read_jsonl(path: Path) -> list[Any]:
    """Read all lines from a .jsonl file."""
    if not path.exists():
        return []
    lines = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if stripped:
                lines.append(json.loads(stripped))
    return lines


def append_jsonl(path: Path, entry: Any) -> None:
    """Append a single entry as a JSON line."""
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
