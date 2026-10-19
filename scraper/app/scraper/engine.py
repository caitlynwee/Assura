"""engine.py — Core scraper pipeline orchestrator.

Pipeline per source: detect change → download → extract → convert → validate → persist.
Invariant: a failed scrape NEVER deletes last good data.
"""

import uuid

from app.config import settings
from app.scraper.change_detector import has_changed, update_source_metadata
from app.scraper.converter import convert_to_plan
from app.scraper.downloader import download_page
from app.scraper.extractor import extract_text
from app.scraper.validator import validate_plan
from app.storage.json_store import append_jsonl, read_json, write_json
from app.utils.time import now_utc_iso


async def run_scraper(
    trigger: str = "manual",
    source_id: str | None = None,
) -> dict:
    sources_path = settings.data_dir / "sources.json"
    plans_path = settings.data_dir / "plans.json"
    runs_path = settings.data_dir / "scraper_runs.jsonl"

    run_id = str(uuid.uuid4())
    started_at = now_utc_iso()
    sources = read_json(sources_path)
    plans: list = read_json(plans_path)

    # Filter to a single source if specified
    if source_id:
        sources = [s for s in sources if s["id"] == source_id]

    checked = 0
    changed = 0
    errors = []

    for source in sources:
        checked += 1
        try:
            changed_flag, response = await has_changed(source)
            if not changed_flag:
                continue

            # Download versioned copy
            content = await download_page(source["url"], response)
            _save_versioned(source["id"], content, started_at)

            # Extract clean text
            text = extract_text(content)

            # Quarantined LLM conversion
            plan_data = await convert_to_plan(text, source)

            # Validate against schema
            validated = validate_plan(plan_data)

            # Merge into plans list — update existing or append
            idx = next((i for i, p in enumerate(plans) if p["id"] in source.get("planIds", [])), None)
            if idx is not None:
                validated["updatedBadge"] = True
                validated["changeNotes"] = plans[idx].get("changeNotes", []) + [
                    f"Updated {started_at[:10]}"
                ]
                plans[idx] = {**plans[idx], **validated}
            else:
                validated["updatedBadge"] = True
                plans.append(validated)

            # Update source metadata
            source = update_source_metadata(source, response, content)
            changed += 1

        except Exception as exc:  # noqa: BLE001
            errors.append({"sourceId": source["id"], "message": str(exc)})

    # Only write if we had no fatal errors (partial success is fine)
    if changed > 0:
        write_json(plans_path, plans)
        write_json(sources_path, sources)

    run_log = {
        "runId": run_id,
        "trigger": trigger,
        "startedAt": started_at,
        "finishedAt": now_utc_iso(),
        "sourcesChecked": checked,
        "sourcesChanged": changed,
        "errors": errors,
    }
    append_jsonl(runs_path, run_log)

    return run_log


def _save_versioned(source_id: str, content: bytes, timestamp: str) -> None:
    versions_dir = settings.data_dir / "versions" / source_id
    versions_dir.mkdir(parents=True, exist_ok=True)
    safe_ts = timestamp[:19].replace(":", "-")
    (versions_dir / f"{safe_ts}.html").write_bytes(content)
