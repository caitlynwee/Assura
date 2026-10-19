
from pydantic import BaseModel


class PremiumsByProfile(BaseModel):
    male_30_nonsmoker: float | None = None
    male_40_nonsmoker: float | None = None
    female_30_nonsmoker: float | None = None
    female_40_nonsmoker: float | None = None


class Plan(BaseModel):
    id: str
    insurer_id: str
    insurer_name: str
    plan_name: str
    category: str = "critical_illness"
    coverage_amount: float
    premiums: PremiumsByProfile
    premium_frequency: str = "annual"
    coverage_terms: list[str] = []
    illnesses_covered: int
    early_stage_conditions: bool
    payout_type: str = "lump_sum"
    key_benefits: list[str] = []
    exclusions: list[str] = []
    source_url: str
    data_as_of: str
    updated_badge: bool = False
    change_notes: list[str] = []
    version: int = 1
    scraped_at: str
