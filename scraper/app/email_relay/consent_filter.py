"""consent_filter.py — Strip data the user has NOT consented to share."""

ALWAYS_BLOCKED = ["nric", "real_email", "phone", "health_history", "income", "name"]


def filter_by_consent(data: dict, consent: dict) -> dict:
    """Return a copy of data with non-consented fields removed."""
    filtered = {}
    for key, value in data.items():
        if key in ALWAYS_BLOCKED:
            continue
        consent_key = f"share_{key}"
        if consent.get(consent_key, False):
            filtered[key] = value
    return filtered
