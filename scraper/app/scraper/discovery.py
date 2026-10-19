"""discovery.py — AI-powered discovery of top 5 CI insurers for any country.

Called by engine.py before each scrape run. Uses DeepSeek to identify the
leading critical illness insurance providers in a given country and returns
their product page URLs as source metadata dicts ready for upsert into the DB.
"""

import json
import re

from openai import AsyncOpenAI

from app.config import settings

DISCOVERY_PROMPT = """\
You are an insurance research assistant.

List the top 5 critical illness insurance companies in {country} that sell \
standalone individual critical illness plans directly to retail customers online.

Return a JSON array ONLY — no prose, no markdown, no code blocks:
[
  {{
    "insurerName": "Full legal company name",
    "insurerId": "lowercase-hyphenated-slug",
    "planName": "Specific standalone CI plan name (not a rider)",
    "planId": "lowercase-hyphenated-slug",
    "productUrl": "https://exact-product-detail-page-url",
    "website": "https://company-homepage-url"
  }}
]

Rules:
1. Return ONLY valid JSON. Your response must start with [ and end with ].
2. productUrl must link to the specific product detail page, not the homepage.
3. Only include standalone critical illness plans — no riders, no bundled life plans.
4. Exactly 5 entries, ordered by market prominence."""


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


async def discover_top_insurers(country: str) -> list[dict]:
    """Return top-5 CI insurer metadata for *country* via DeepSeek.

    Each dict has:
      insurer_id, insurer_name, plan_id, plan_name,
      source_id, product_url, website, country
    """
    client = AsyncOpenAI(
        api_key=settings.deepseek_api_key,
        base_url="https://api.deepseek.com",
    )

    response = await client.chat.completions.create(
        model=settings.llm_model,
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": DISCOVERY_PROMPT.format(country=country),
            }
        ],
    )

    raw = response.choices[0].message.content or ""

    try:
        companies = json.loads(raw.strip())
    except json.JSONDecodeError as exc:
        raise ValueError(f"Discovery LLM returned non-JSON: {raw[:300]}") from exc

    if not isinstance(companies, list):
        raise TypeError(f"Discovery expected a list, got {type(companies).__name__}")

    results = []
    for i, co in enumerate(companies[:5]):
        insurer_id = co.get("insurerId") or _slugify(
            co.get("insurerName", f"insurer-{i}")
        )
        plan_id = co.get("planId") or f"{insurer_id}-ci"
        results.append(
            {
                "insurer_id": insurer_id,
                "insurer_name": co.get("insurerName", insurer_id),
                "plan_id": plan_id,
                "plan_name": co.get("planName", "Critical Illness Plan"),
                "source_id": f"src_{insurer_id}_ci",
                "product_url": co.get("productUrl", ""),
                "website": co.get("website", ""),
                "country": country,
            }
        )

    return results
