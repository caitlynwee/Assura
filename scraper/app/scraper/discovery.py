"""discovery.py — Discover top CI insurers + their brochure PDFs.

Two-step pipeline:
  1. DeepSeek: identify the top 5 CI insurer names + homepages for a country
  2. Jina Search (s.jina.ai): for each insurer, search for the actual PDF
     brochure URL — real web search, no guessing

This separates "who are the players" (LLM knowledge) from "where is the PDF"
(live web search), giving accurate URLs without hallucination.
"""

import json
import os
import re

from openai import AsyncOpenAI

from app.config import settings

# ── Step 1: DeepSeek finds insurer names ──────────────────────────────────────

DISCOVERY_PROMPT = """\
You are an insurance research assistant.

List the top 5 critical illness insurance companies in {country} that sell \
standalone individual critical illness plans directly to retail customers.

Return a JSON array ONLY — no prose, no markdown, no code blocks:
[
  {{
    "insurerName": "Full legal company name",
    "insurerId": "lowercase-hyphenated-slug",
    "planName": "Specific standalone CI plan name (not a rider)",
    "planId": "lowercase-hyphenated-slug",
    "website": "https://company-homepage-url"
  }}
]

Rules:
1. Return ONLY valid JSON. Your response must start with [ and end with ].
2. Only standalone critical illness plans — no riders, no bundled life plans.
3. Exactly 5 entries, ordered by market prominence."""


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _search_brochure_url(insurer_name: str, plan_name: str, country: str) -> str:
    """Use DuckDuckGo to find the actual PDF brochure URL for a CI plan."""
    from duckduckgo_search import DDGS

    query = f'{insurer_name} "{plan_name}" {country} critical illness brochure filetype:pdf'
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=10))

        # Prefer results with .pdf in the URL
        for r in results:
            url = r.get("href", "")
            if ".pdf" in url.lower():
                print(f"[discovery] Found PDF for {insurer_name}: {url}")
                return url

        # Fall back to first result from any source
        if results:
            url = results[0].get("href", "")
            print(f"[discovery] Fallback URL for {insurer_name}: {url}")
            return url

    except Exception as exc:  # noqa: BLE001
        print(f"[discovery] DuckDuckGo search failed for {insurer_name}: {exc}")

    return ""


async def discover_top_insurers(country: str) -> list[dict]:
    """Return top-5 CI insurer metadata for *country*.

    Step 1 — DeepSeek identifies insurer names + homepages.
    Step 2 — Jina Search finds the actual PDF brochure URL for each.
    """
    client = AsyncOpenAI(
        api_key=settings.deepseek_api_key,
        base_url="https://api.deepseek.com",
    )

    response = await client.chat.completions.create(
        model=settings.llm_model,
        max_tokens=1024,
        messages=[{"role": "user", "content": DISCOVERY_PROMPT.format(country=country)}],
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
        insurer_id = co.get("insurerId") or _slugify(co.get("insurerName", f"insurer-{i}"))
        plan_id = co.get("planId") or f"{insurer_id}-ci"
        insurer_name = co.get("insurerName", insurer_id)
        plan_name = co.get("planName", "Critical Illness Plan")

        # Step 2: DuckDuckGo search for the real PDF URL
        brochure_url = _search_brochure_url(insurer_name, plan_name, country)

        print(f"[discovery] {insurer_name} → {brochure_url or '(no PDF found)'}")
        results.append({
            "insurer_id": insurer_id,
            "insurer_name": insurer_name,
            "plan_id": plan_id,
            "plan_name": plan_name,
            "source_id": f"src_{insurer_id}_ci",
            "product_url": brochure_url,
            "website": co.get("website", ""),
            "country": country,
        })

    return results
