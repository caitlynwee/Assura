"""validator.py — Validate the LLM-converted plan dict against the schema."""

from pydantic import ValidationError

from app.schemas.plan import Plan


def _lookup_insurer_name(insurer_id: str) -> str:
    """Look up insurer display name from insurers.json by id."""
    try:
        from app.config import settings
        from app.storage.json_store import read_json

        insurers_path = settings.data_dir / "insurers.json"
        if insurers_path.exists():
            insurers = read_json(insurers_path)
            match = next((i for i in insurers if i["id"] == insurer_id), None)
            if match:
                return match.get("name", "")
    except Exception:  # noqa: BLE001, S110
        pass
    return ""


def validate_plan(data: dict) -> dict:
    """Validate and normalize plan data. Raises ValueError if invalid."""
    # Fill insurerName from insurers.json if empty
    insurer_id = data.get("insurerId", "")
    if not data.get("insurerName") and insurer_id:
        data["insurerName"] = _lookup_insurer_name(insurer_id)

    # Normalize camelCase keys to snake_case for Pydantic
    normalized = {
        "id": data.get("id", ""),
        "insurer_id": data.get("insurerId", ""),
        "insurer_name": data.get("insurerName", ""),
        "plan_name": data.get("planName", ""),
        "category": data.get("category", "critical_illness"),
        "coverage_amount": data.get("coverageAmount", 0),
        "premiums": data.get("premiums", {}),
        "premium_frequency": data.get("premiumFrequency", "annual"),
        "coverage_terms": data.get("coverageTerms", []),
        "illnesses_covered": data.get("illnessesCovered", 0),
        "early_stage_conditions": data.get("earlyStageConditions", False),
        "payout_type": data.get("payoutType", "lump_sum"),
        "key_benefits": data.get("keyBenefits", []),
        "exclusions": data.get("exclusions", []),
        "source_url": data.get("sourceUrl", ""),
        "data_as_of": data.get("dataAsOf", ""),
        "updated_badge": data.get("updatedBadge", False),
        "change_notes": data.get("changeNotes", []),
        "version": data.get("version", 1),
        "scraped_at": data.get("scrapedAt", ""),
    }

    try:
        plan = Plan(**normalized)
    except ValidationError as e:
        raise ValueError(f"Plan validation failed: {e}") from e

    # Return as camelCase dict (matches plans.json format)
    return {
        "id": plan.id,
        "insurerId": plan.insurer_id,
        "insurerName": plan.insurer_name,
        "planName": plan.plan_name,
        "category": plan.category,
        "coverageAmount": plan.coverage_amount,
        "premiums": plan.premiums.model_dump(exclude_none=True),
        "premiumFrequency": plan.premium_frequency,
        "coverageTerms": plan.coverage_terms,
        "illnessesCovered": plan.illnesses_covered,
        "earlyStageConditions": plan.early_stage_conditions,
        "payoutType": plan.payout_type,
        "keyBenefits": plan.key_benefits,
        "exclusions": plan.exclusions,
        "sourceUrl": plan.source_url,
        "dataAsOf": plan.data_as_of,
        "updatedBadge": plan.updated_badge,
        "changeNotes": plan.change_notes,
        "version": plan.version,
        "scrapedAt": plan.scraped_at,
    }
