"""validator.py — Validate the LLM-converted plan dict against the schema."""

from pydantic import ValidationError

from app.schemas.plan import Plan


def validate_plan(data: dict) -> dict:
    """Validate and normalize plan data. Raises ValueError if invalid."""
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

    # Return the camelCase plan shape consumed by the backend API.
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
