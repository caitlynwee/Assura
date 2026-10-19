"""pii_blocker.py — Scan outgoing email bodies for Singapore PII patterns.

Blocks: NRIC, phone numbers, health keywords, income references.
Fail-closed: if scan raises, treat as blocked.
"""

import re
from dataclasses import dataclass, field

NRIC_PATTERN = re.compile(r"\b[STFGM]\d{7}[A-Z]\b", re.IGNORECASE)
PHONE_PATTERN = re.compile(r"(\+65[\s\-]?)?(\(65\)[\s\-]?)?[6|8|9]\d{3}[\s\-]?\d{4}\b")

HEALTH_KEYWORDS = [
    "diagnosis", "diagnosed", "medical history", "medical condition",
    "pre-existing", "cancer", "diabetes", "hypertension", "heart disease",
    "stroke", "kidney disease", "liver disease", "mental health", "depression",
    "anxiety", "medication", "prescription", "surgery", "hospitalized",
    "hospitalisation", "treatment", "chemotherapy", "dialysis",
    "hiv", "aids", "asthma", "epilepsy",
]

INCOME_KEYWORDS = [
    "annual income", "monthly income", "salary", "net worth",
    "assets", "cpf", "cpf balance", "income tax", "noa",
]


@dataclass
class PiiMatch:
    type: str
    value: str
    index: int


@dataclass
class BlockerResult:
    blocked: bool
    matches: list[PiiMatch] = field(default_factory=list)


def scan_for_pii(text: str) -> BlockerResult:
    matches = []
    lower = text.lower()

    for m in NRIC_PATTERN.finditer(text):
        matches.append(PiiMatch("nric", m.group(), m.start()))

    for m in PHONE_PATTERN.finditer(text):
        matches.append(PiiMatch("phone", m.group(), m.start()))

    for kw in HEALTH_KEYWORDS:
        idx = lower.find(kw.lower())
        if idx != -1:
            matches.append(PiiMatch("health_keyword", kw, idx))

    for kw in INCOME_KEYWORDS:
        idx = lower.find(kw.lower())
        if idx != -1:
            matches.append(PiiMatch("income", kw, idx))

    return BlockerResult(blocked=bool(matches), matches=matches)


def assert_no_pii(text: str) -> None:
    """Raise ValueError if PII is detected."""
    result = scan_for_pii(text)
    if result.blocked:
        types = list({m.type for m in result.matches})
        raise ValueError(
            f"Send blocked: detected personal data in email ({', '.join(types)}). "
            "Remove this information before sending."
        )
