"""engine.py — Core scraper pipeline orchestrator.

Pipeline per source: detect change → download → extract → convert → validate → persist.
Invariant: a failed scrape NEVER deletes last good data — we only commit to the DB
when changed > 0 and all per-source processing succeeded (errors are non-fatal per
source but the overall commit is skipped unless at least one source changed).

Country flow:
  1. discover_top_insurers(country) → upsert insurer + source rows
  2. Load all sources tagged with that country
  3. Run change-detection → download → extract → LLM → validate → persist for each
"""

import uuid

from app.config import settings
from app.scraper.change_detector import has_changed, update_source_metadata
from app.scraper.converter import convert_to_plan
from app.scraper.discovery import discover_top_insurers
from app.scraper.downloader import download_page
from app.scraper.extractor import extract_text
from app.scraper.validator import validate_plan
from app.storage.database import (
    Insurer,
    Plan,
    ScraperRun,
    Source,
    apply_source_update,
    get_session,
    source_to_camel,
)
from app.utils.time import now_utc_iso


def _upsert_discovered(session, discovered: list[dict]) -> None:
    """Upsert insurer + source rows returned by discover_top_insurers()."""
    for co in discovered:
        # Insurer — insert if new, skip if exists
        existing_insurer = session.query(Insurer).filter_by(id=co["insurer_id"]).first()
        if not existing_insurer:
            session.add(
                Insurer(
                    id=co["insurer_id"],
                    name=co["insurer_name"],
                    agent_email="",      # no outreach configured for discovered insurers
                    logo="",
                    persona="helpful",
                    website=co["website"],
                    country=co["country"],
                )
            )

        # Source — insert if new, skip if exists (preserve existing metadata)
        existing_source = session.query(Source).filter_by(id=co["source_id"]).first()
        if not existing_source:
            session.add(
                Source(
                    id=co["source_id"],
                    insurer_id=co["insurer_id"],
                    label=f"{co['insurer_name']} {co['plan_name']}",
                    url=co["product_url"],
                    type="product_page",
                    plan_ids=[co["plan_id"]],
                    etag=None,
                    last_modified=None,
                    content_hash=None,
                    last_checked=None,
                    last_changed=None,
                    status="pending",
                    country=co["country"],
                )
            )

    session.flush()  # make new rows visible within this transaction


async def run_scraper(
    trigger: str = "manual",
    source_id: str | None = None,
    country: str | None = None,
) -> dict:
    country = country or settings.current_country
    run_id = str(uuid.uuid4())
    started_at = now_utc_iso()

    session = get_session()
    try:
        # ── Discovery: find top 5 CI sources for this country ──────────────────
        # Only runs on full (non-targeted) scrape runs so we always have fresh
        # source rows even when the country is changed in config.
        if not source_id:
            try:
                discovered = await discover_top_insurers(country)
                _upsert_discovered(session, discovered)
            except Exception:  # noqa: BLE001, S110
                # Discovery failure is non-fatal — proceed with whatever sources exist
                pass

        # ── Load sources ───────────────────────────────────────────────────────
        if source_id:
            sources = session.query(Source).filter_by(id=source_id).all()
        else:
            sources = session.query(Source).filter_by(country=country).all()

        # Index insurers + plans for fast lookup
        insurers_by_id = {i.id: i for i in session.query(Insurer).all()}
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

                content = await download_page(
                    source_dict["url"], response,
                    source_type=source_dict.get("type", "product_page"),
                )

                text = extract_text(content)
                plan_data = await convert_to_plan(text, source_dict)

                # Fill insurerName from DB (converter always leaves it blank)
                insurer = insurers_by_id.get(source_dict["insurerId"])
                if insurer:
                    plan_data["insurerName"] = insurer.name

                validated = validate_plan(plan_data)

                plan_ids = source_dict.get("planIds") or []
                existing_plan = next(
                    (plans_by_id[pid] for pid in plan_ids if pid in plans_by_id),
                    None,
                )
                if existing_plan is not None:
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
                        country=country,
                    )
                    session.add(new_plan)
                    plans_by_id[new_plan.id] = new_plan

                updated_source_dict = update_source_metadata(source_dict, response, content)
                apply_source_update(source, updated_source_dict)

                changed += 1

            except Exception as exc:  # noqa: BLE001
                errors.append({"sourceId": source_dict["id"], "message": str(exc)})

        if changed == 0:
            session.expunge_all()

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
        "country": country,
        "startedAt": started_at,
        "finishedAt": now_utc_iso(),
        "sourcesChecked": checked,
        "sourcesChanged": changed,
        "errors": errors,
    }
