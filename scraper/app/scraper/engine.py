"""engine.py — Core scraper pipeline orchestrator.

Pipeline:
  Phase 1 (per source): detect change → download → extract → accumulate text by plan_id
  Phase 2 (per plan):   combine PDF + product-page text → LLM → validate → persist

Two sources per insurer (created by discovery):
  src_{insurer_id}_ci_pdf   → type="pdf",          PDF brochure URL
  src_{insurer_id}_ci_page  → type="product_page",  product page URL

Invariant: a failed scrape NEVER deletes last good data — we only commit when
at least one source changed and Phase 2 succeeds per plan (errors are non-fatal).
"""

import uuid

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
    """Upsert insurer + two source rows (pdf + product_page) per insurer."""
    for co in discovered:
        # Insurer — insert if new, skip if exists
        if not session.query(Insurer).filter_by(id=co["insurer_id"]).first():
            session.add(
                Insurer(
                    id=co["insurer_id"],
                    name=co["insurer_name"],
                    agent_email="",
                    logo="",
                    persona="helpful",
                    website=co["website"],
                    country=co["country"],
                )
            )

        label_base = f"{co['insurer_name']} {co['plan_name']}"

        # PDF brochure source
        if co.get("brochure_url"):
            pdf_id = f"src_{co['insurer_id']}_ci_pdf"
            existing_pdf = session.query(Source).filter_by(id=pdf_id).first()
            if existing_pdf:
                if existing_pdf.url != co["brochure_url"]:
                    existing_pdf.url = co["brochure_url"]
                    existing_pdf.content_hash = None
                    existing_pdf.etag = None
                    existing_pdf.last_modified = None
                    existing_pdf.status = "pending"
            else:
                session.add(
                    Source(
                        id=pdf_id,
                        insurer_id=co["insurer_id"],
                        label=f"{label_base} Brochure",
                        url=co["brochure_url"],
                        type="pdf",
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

        # Product page source
        if co.get("product_url"):
            page_id = f"src_{co['insurer_id']}_ci_page"
            existing_page = session.query(Source).filter_by(id=page_id).first()
            if existing_page:
                if existing_page.url != co["product_url"]:
                    existing_page.url = co["product_url"]
                    existing_page.content_hash = None
                    existing_page.etag = None
                    existing_page.last_modified = None
                    existing_page.status = "pending"
            else:
                session.add(
                    Source(
                        id=page_id,
                        insurer_id=co["insurer_id"],
                        label=label_base,
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

    session.flush()


async def run_scraper(
    trigger: str = "manual",
    source_id: str | None = None,
    country: str | None = None,
) -> dict:
    country = country or "Singapore"
    run_id = str(uuid.uuid4())
    started_at = now_utc_iso()

    session = get_session()
    try:
        # ── Discovery — only when no sources exist for this country ───────────
        # Skipping discovery on re-runs avoids burning Firecrawl credits and
        # prevents UniqueViolation/PendingRollback errors when rows already exist.
        if not source_id:
            existing_count = session.query(Source).filter_by(country=country).count()
            if existing_count == 0:
                try:
                    discovered = await discover_top_insurers(country)
                    _upsert_discovered(session, discovered)
                except Exception:  # noqa: BLE001
                    session.rollback()  # reset session so subsequent queries work

        # ── Load sources ───────────────────────────────────────────────────────
        if source_id:
            sources = session.query(Source).filter_by(id=source_id).all()
        else:
            sources = session.query(Source).filter_by(country=country).all()
        print(f"[engine] loaded {len(sources)} sources: {[s.id for s in sources]}")

        insurers_by_id = {i.id: i for i in session.query(Insurer).all()}
        plans_by_id = {p.id: p for p in session.query(Plan).all()}

        checked = 0
        changed = 0
        errors = []

        # ── Phase 1: Download per source, accumulate text by plan_id ──────────
        # plan_texts: plan_id → {pdf: str, product_page: str, source_dict: dict,
        #                         pdf_url: str, product_url: str}
        plan_texts: dict[str, dict] = {}

        for source in sources:
            checked += 1
            source_dict = source_to_camel(source)
            try:
                changed_flag, response = await has_changed(source_dict)
                if not changed_flag:
                    print(f"[engine] {source_dict['id']} unchanged — skipping")
                    continue

                source_type = source_dict.get("type", "product_page")
                content = await download_page(
                    source_dict["url"], response, source_type=source_type,
                )
                text = extract_text(content, source_type=source_type)
                print(
                    f"[engine] {source_dict['id']} ({source_type}) "
                    f"snippet: {text[200:600]!r}"
                )

                # Accumulate text + URLs by plan_id — PDF source_dict takes priority
                for plan_id in (source_dict.get("planIds") or []):
                    if plan_id not in plan_texts:
                        plan_texts[plan_id] = {
                            "pdf": "",
                            "product_page": "",
                            "source_dict": source_dict,
                            "pdf_url": "",
                            "product_url": "",
                        }
                    plan_texts[plan_id][source_type] = text
                    if source_type == "pdf":
                        plan_texts[plan_id]["source_dict"] = source_dict
                        plan_texts[plan_id]["pdf_url"] = source_dict["url"]
                    elif source_type == "product_page":
                        plan_texts[plan_id]["product_url"] = source_dict["url"]

                # Upload raw PDF to Supabase Storage when available
                if source_type == "pdf" and response.content[:4] == b"%PDF":
                    from app.utils.storage import upload_pdf
                    storage_url = await upload_pdf(source_dict["id"], response.content)
                    if storage_url:
                        source.storage_url = storage_url

                # Update source metadata immediately (per-source, not per-plan)
                updated_source_dict = update_source_metadata(
                    source_dict, response, response.content
                )
                apply_source_update(source, updated_source_dict)

                changed += 1

            except Exception as exc:  # noqa: BLE001
                msg = str(exc) or type(exc).__name__
                print(f"[engine] ERROR {source_dict['id']}: {type(exc).__name__}: {msg}")
                errors.append(
                    {"sourceId": source_dict["id"], "message": f"{type(exc).__name__}: {msg}"}
                )

        # ── Phase 2: Combine texts per plan, one LLM call each ────────────────
        for plan_id, info in plan_texts.items():
            try:
                pdf_text = info.get("pdf", "")
                page_text = info.get("product_page", "")
                source_dict = info["source_dict"]

                parts = []
                if pdf_text:
                    parts.append(f"--- PDF BROCHURE ---\n{pdf_text}")
                if page_text:
                    parts.append(f"--- PRODUCT PAGE ---\n{page_text}")
                combined = "\n\n".join(parts)

                plan_data = await convert_to_plan(combined, source_dict)
                # Attach both URLs — sourceUrl is PDF if found, else product page
                plan_data["productUrl"] = info.get("product_url", "")
                if info.get("pdf_url"):
                    plan_data["sourceUrl"] = info["pdf_url"]

                insurer = insurers_by_id.get(source_dict["insurerId"])
                if insurer:
                    plan_data["insurerName"] = insurer.name
                    contact_email = plan_data.get("contactEmail", "")
                    if contact_email and not insurer.agent_email:
                        insurer.agent_email = contact_email

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
                    existing_plan.product_url = validated.get("productUrl", existing_plan.product_url)
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
                        product_url=validated.get("productUrl", ""),
                        data_as_of=validated.get("dataAsOf", ""),
                        updated_badge=True,
                        change_notes=[f"Added {started_at[:10]}"],
                        version=1,
                        scraped_at=started_at,
                        country=country,
                    )
                    session.merge(new_plan)
                    plans_by_id[new_plan.id] = new_plan

            except Exception as exc:  # noqa: BLE001
                msg = str(exc) or type(exc).__name__
                errors.append(
                    {"planId": plan_id, "message": f"{type(exc).__name__}: {msg}"}
                )

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
