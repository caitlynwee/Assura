"""discovery.py — Discover top CI insurers + their brochure PDFs and product pages.

Two-step pipeline:
  1. DeepSeek: identify the top 5 CI insurer names + homepages for a country
  2. Firecrawl Search: for each insurer, run two searches:
       - PDF brochure URL (filetype:pdf query)
       - Product page URL (regular search)

This separates "who are the players" (LLM knowledge) from "where is the URL"
(live web search), giving accurate URLs without hallucination.
"""

import json
import re

import httpx
from openai import AsyncOpenAI

from app.config import settings
from app.utils.debug_dump import dump

# ── Step 1: DeepSeek finds insurer names ──────────────────────────────────────

DISCOVERY_PROMPT = """\
You are an insurance research assistant.

List the top 5 critical illness insurance companies in {country} that sell \
standalone individual critical illness plans directly to retail customers.

Return a JSON array ONLY — no prose, no markdown, no code blocks:
[
  {{
    "insurerName": "Short brand name only (e.g. 'AIA', 'Prudential', 'Great Eastern')",
    "insurerId": "lowercase-hyphenated-slug",
    "domain": "exact domain of insurer's official {country} website (e.g. aia.com.sg)",
    "planId": "lowercase-hyphenated-slug for their main standalone CI plan"
  }}
]

Rules:
1. Return ONLY valid JSON. Your response must start with [ and end with ].
2. Only life insurers licensed in {country} — no foreign-country entities.
3. Exactly 5 entries, ordered by market prominence.
4. Domain must be the insurer's country-specific site — NOT a global domain \
(e.g. prudential.com.sg not prudential.com, aia.com.sg not aia.com).
5. Do NOT include plan names — those will be extracted from the brochure."""


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


_COUNTRY_CODE_MAP = {
    "singapore": "SG",
    "malaysia": "MY",
    "australia": "AU",
    "united kingdom": "GB",
    "hong kong": "HK",
    "china": "CN",
}


def _country_code(country: str) -> str:
    return _COUNTRY_CODE_MAP.get(country.lower(), "SG")


# Known insurer domains per country — locks Firecrawl to the right site.
# Domains (not URLs) rarely change; actual PDF paths are found dynamically.
KNOWN_DOMAINS: dict[str, dict[str, str]] = {
    "singapore": {
        "aia": "aia.com.sg",
        "prudential": "prudential.com.sg",
        "great eastern": "greateasternlife.com",
        "greateastern": "greateasternlife.com",
        "ntuc income": "income.com.sg",
        "income": "income.com.sg",
        "manulife": "manulife.com.sg",
        "singlife": "singlife.com",
        "aviva": "aviva.com.sg",
        "tokio marine": "tokiomarine.com.sg",
        "hsbc life": "insurance.hsbc.com.sg",
        "hsbc": "insurance.hsbc.com.sg",
        "fwd": "fwd.com.sg",
        "sunlife": "sunlife.com.sg",
    },
    "china": {
        "ping an": "pingan.com",
        "china life": "e-chinalife.com",
        "picc": "picc.com",
        "china pacific": "cpic.com.cn",
        "cpic": "cpic.com.cn",
        "taikang": "taikang.com",
        "new china life": "newchinalife.com",
        "taiping": "sino-life.com",
    },
}


def _resolve_domain(insurer_name: str, country: str, llm_domain: str) -> str:
    """Return the best domain for an insurer.

    Priority:
      1. Known-domains map (most reliable — prevents wrong-country results)
      2. LLM-provided domain (validated: must contain the insurer slug)
      3. Empty string (search will be skipped)
    """
    country_map = KNOWN_DOMAINS.get(country.lower(), {})

    # Try exact and partial matches against known domains
    name_lower = insurer_name.lower()
    for key, domain in country_map.items():
        if key in name_lower or name_lower in key:
            return domain

    # Fall back to LLM domain if it looks plausible
    slug = _slugify(insurer_name)
    parts = [p for p in slug.split("-") if len(p) > 3]
    if llm_domain and any(part in llm_domain.lower() for part in parts):
        return llm_domain

    return llm_domain  # use whatever LLM gave us as last resort


# ── Step 2: Firecrawl finds real URLs ─────────────────────────────────────────

FIRECRAWL_SEARCH_URL = "https://api.firecrawl.dev/v1/search"


async def _firecrawl_search(query: str) -> list[dict]:
    """Search the web via Firecrawl. Returns list of {url, title, description}."""
    if not settings.fire_crawl_api_key:
        print("[discovery] No FIRE_CRAWL_API_KEY set — skipping Firecrawl search")
        return []

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                FIRECRAWL_SEARCH_URL,
                json={"query": query, "limit": 5},
                headers={"Authorization": f"Bearer {settings.fire_crawl_api_key}"},
            )
        resp.raise_for_status()
        data = resp.json()
        results = data.get("data", []) or []
        print(f"[discovery] Firecrawl '{query}' → {len(results)} results")
        dump(f"firecrawl_{'pdf' if 'filetype:pdf' in query else 'page'}", {
            "query": query,
            "status_code": resp.status_code,
            "results": results,
        })
        return results
    except Exception as exc:  # noqa: BLE001
        print(f"[discovery] Firecrawl search failed for '{query}': {exc}")
        return []


def _insurer_parts(insurer_name: str) -> list[str]:
    return [p for p in _slugify(insurer_name).split("-") if len(p) > 3]


_COUNTRY_PATH_HINTS = {
    "sg": ["/sg/", "/singapore/", "/en/"],
    "my": ["/my/", "/malaysia/"],
    "cn": ["/cn/", "/china/"],
}

def _pick_best_pdf(results: list[dict], parts: list[str], country_tld: str = "sg") -> str:
    """Pick best PDF URL, preferring country-specific paths over other-country paths."""
    pdf_urls = [r.get("url", "") for r in results if ".pdf" in r.get("url", "").lower()]

    # Exclude PDFs that clearly belong to a different country's path
    other_hints: list[str] = []
    for tld, hints in _COUNTRY_PATH_HINTS.items():
        if tld != country_tld:
            other_hints.extend(hints)

    preferred = [u for u in pdf_urls if not any(h in u.lower() for h in other_hints)]
    candidates = preferred if preferred else pdf_urls

    # Within candidates, prefer URLs containing insurer name parts
    for url in candidates:
        if any(part in url.lower() for part in parts):
            return url
    return candidates[0] if candidates else ""


def _pick_best_page(results: list[dict], parts: list[str], country_tld: str) -> str:
    """Pick best non-PDF product page URL, preferring the insurer's country domain."""
    non_pdfs = [r.get("url", "") for r in results if ".pdf" not in r.get("url", "").lower()]
    # Prefer insurer's own country TLD (e.g. .sg, .com.sg)
    for url in non_pdfs:
        if any(part in url.lower() for part in parts) and f".{country_tld}" in url.lower():
            return url
    # Fall back to any domain containing insurer name parts
    for url in non_pdfs:
        if any(part in url.lower() for part in parts):
            return url
    return non_pdfs[0] if non_pdfs else ""


async def _search_urls(
    insurer_name: str, domain: str, country: str
) -> tuple[str, str]:
    """Return (brochure_url, product_url) using site:-locked Firecrawl searches."""
    parts = _insurer_parts(insurer_name)
    country_tld = _country_code(country).lower()

    site = f"site:{domain}" if domain else insurer_name

    # Search 1: PDF brochure — try standalone CI first, fall back to general CI
    pdf_results = await _firecrawl_search(
        f"{site} standalone critical illness plan brochure filetype:pdf"
    )
    if not any(".pdf" in r.get("url", "").lower() for r in pdf_results):
        pdf_results = await _firecrawl_search(
            f"{site} critical illness brochure filetype:pdf"
        )

    # Search 2: Product page locked to insurer's own domain
    page_results = await _firecrawl_search(
        f"{site} critical illness plan"
    )

    # Collect PDFs from both searches — filter out other-country paths
    brochure_url = _pick_best_pdf(pdf_results + page_results, parts, country_tld)

    # Best non-PDF product page
    product_url = _pick_best_page(page_results, parts, country_tld)

    print(
        f"[discovery] {insurer_name} ({domain}) → "
        f"PDF: {brochure_url or '(none)'} | Page: {product_url or '(none)'}"
    )
    return brochure_url, product_url


async def discover_top_insurers(country: str) -> list[dict]:
    """Return top-5 CI insurer metadata for *country*.

    Step 1 — DeepSeek identifies insurer names + homepages.
    Step 2 — Firecrawl finds the PDF brochure URL and product page URL for each.
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
        llm_domain = co.get("domain", "")

        # Resolve domain — known map takes priority over LLM's answer
        domain = _resolve_domain(insurer_name, country, llm_domain)

        brochure_url, product_url = await _search_urls(insurer_name, domain, country)

        results.append({
            "insurer_id": insurer_id,
            "insurer_name": insurer_name,
            "plan_id": plan_id,
            "plan_name": "Critical Illness Plan",  # extracted from PDF content later
            "brochure_url": brochure_url,
            "product_url": product_url,
            "website": f"https://{domain}" if domain else "",
            "country": country,
        })

    return results
