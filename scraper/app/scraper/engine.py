"""engine.py — Core scraper pipeline orchestrator.

Pipeline per source: detect change → download → extract → convert → validate → persist.
Invariant: a failed scrape NEVER deletes last good data — we only commit to the DB
when changed > 0 and all per-source processing succeeded (errors are non-fatal per
source but the overall commit is skipped unless at least one source changed).
"""

import uuid

from app.config import settings
from app.scraper.change_detector import has_changed, update_source_metadata
from app.scraper.converter import convert_to_plan
from app.scraper.downloader import download_page
from app.scraper.extractor import extract_text
from app.scraper.validator import validate_plan
from app.storage.database import (
    Plan,
    ScraperRun,
    Source,
    apply_source_update,
    get_session,
    source_to_camel,
)
from app.utils.time import now_utc_iso


async def run_scraper(
    trigger: str = "manual",
    source_id: str | None = None,
) -> dict:
    run_id = str(uuid.uuid4())
    started_at = now_utc_iso()

    session = get_session()
    try:
        # Load sources and plans from DB
        if source_id:
            sources = session.query(Source).filter_by(id=source_id).all()
        else:
            sources = session.query(Source).all()

        # Index plans by id for fast lookup
        all_plans = session.query(Plan).all()
        plans_by_id = {p.id: p for p in all_plans}

        checked = 0
        changed = 0
        errors = []

        for source in sources:
            checked += 1
            source_dict = source_to_camel(source)
            try:
                changed_flag, response = await has_changed(source_dict)
                if not changed_flag:
                    continue

                # Download versioned copy
                content = await download_page(
                    source_dict["url"], response,
                    source_type=source_dict.get("type", "product_page"),
                )
                _save_versioned(source_dict["id"], content, started_at)

                # Extract clean text
                text = extract_text(content)

                # Quarantined LLM conversion
                plan_data = await convert_to_plan(text, source_dict)

                # Validate against schema
                validated = validate_plan(plan_data)

                # Merge into DB — update existing plan or insert new one
                plan_ids = source_dict.get("planIds") or []
                existing_plan = next(
                    (plans_by_id[pid] for pid in plan_ids if pid in plans_by_id),
                    None,
                )
                if existing_plan is not None:
                    # Update existing plan row
                    old_notes = existing_plan.change_notes or []
                    existing_plan.insurer_name = validated.get("insurerName", existing_plan.insurer_name)
                    existing_plan.plan_name = validated.get("planName", existing_plan.plan_name)
                    existing_plan.category = validated.get("category", existing_plan.category)
                    existing_plan.coverage_amount = validated.get("coverageAmount", existing_plan.coverage_amount)
                    existing_plan.premiums = validated.get("premiums", existing_plan.premiums)
                    existing_plan.premium_frequency = validated.get("premiumFrequency", existing_plan.premium_frequency)
                    existing_plan.coverage_terms = validated.get("coverageTerms", existing_plan.coverage_terms)
                    existing_plan.illnesses_covered = validated.get("illnessesCovered", existing_plan.illnesses_covered)
                    existing_plan.early_stage_conditions = validated.get("earlyStageConditions", existing_plan.early_stage_conditions)
                    existing_plan.payout_type = validated.get("payoutType", existing_plan.payout_type)
                    existing_plan.key_benefits = validated.get("keyBenefits", existing_plan.key_benefits)
                    existing_plan.exclusions = validated.get("exclusions", existing_plan.exclusions)
                    existing_plan.source_url = validated.get("sourceUrl", existing_plan.source_url)
                    existing_plan.data_as_of = validated.get("dataAsOf", existing_plan.data_as_of)
                    existing_plan.updated_badge = True
                    existing_plan.change_notes = old_notes + [f"Updated {started_at[:10]}"]
                    existing_plan.version = existing_plan.version + 1
                    existing_plan.scraped_at = started_at
                else:
                    # Insert new plan row
                    new_plan = Plan(
                        id=validated["id"],
                        insurer_id=validated.get("insurerId", ""),
                        insurer_name=validated.get("insurerName", ""),
                        plan_name=validated.get("planName", ""),
                        category=validated.get("category", "critical_illness"),
                        coverage_amount=validated.get("coverageAmount", 0),
                        premiums=validated.get("premiums", {}),
                        premium_frequency=validated.get("premiumFrequency", "annual"),
                        coverage_terms=validated.get("coverageTerms", []),
                        illnesses_covered=validated.get("illnessesCovered", 0),
                        early_stage_conditions=validated.get("earlyStageConditions", False),
                        payout_type=validated.get("payoutType", "lump_sum"),
                        key_benefits=validated.get("keyBenefits", []),
                        exclusions=validated.get("exclusions", []),
                        source_url=validated.get("sourceUrl", ""),
                        data_as_of=validated.get("dataAsOf", ""),
                        updated_badge=True,
                        change_notes=[f"Added {started_at[:10]}"],
                        version=1,
                        scraped_at=started_at,
                    )
                    session.add(new_plan)
                    plans_by_id[new_plan.id] = new_plan

                # Update source metadata (etag, hash, timestamps)
                updated_source_dict = update_source_metadata(source_dict, response, content)
                apply_source_update(source, updated_source_dict)

                changed += 1

            except Exception as exc:  # noqa: BLE001
                errors.append({"sourceId": source_dict["id"], "message": str(exc)})

        # Only persist plan/source changes if at least one source succeeded.
        # session.commit() flushes before committing, so we expunge_all() when
        # nothing changed to guarantee dirty objects are never accidentally written.
        # A failed scrape must NEVER delete last good data.
        if changed == 0:
            session.expunge_all()  # discard any partially-modified ORM objects

        # Always record the run (even if nothing changed)
        run_row = ScraperRun(
            run_id=run_id,
            trigger=trigger,
            started_at=started_at,
            finished_at=now_utc_iso(),
            sources_checked=checked,
            sources_changed=changed,
            errors=errors,
        )
        session.add(run_row)
        session.commit()

    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

    return {
        "runId": run_id,
        "trigger": trigger,
        "startedAt": started_at,
        "finishedAt": now_utc_iso(),
        "sourcesChecked": checked,
        "sourcesChanged": changed,
        "errors": errors,
    }


def _save_versioned(source_id: str, content: bytes, timestamp: str) -> None:
    """Save a versioned HTML snapshot to the filesystem (not DB)."""
    versions_dir = settings.data_dir / "versions" / source_id
    versions_dir.mkdir(parents=True, exist_ok=True)
    safe_ts = timestamp[:19].replace(":", "-")
    (versions_dir / f"{safe_ts}.html").write_bytes(content)
