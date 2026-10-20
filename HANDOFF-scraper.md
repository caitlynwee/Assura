# Web Scraper Feature — Handover

**Branch:** `feat/scraper`
**Status:** In Progress — pipeline works end-to-end, PDF URL discovery still being resolved

---

## What Was Built

### Full scraping pipeline (working)
When a user clicks **"Refresh data"** on the Compare Plans page:

```
Compare page → POST /api/scraper/trigger (web)
  → POST /scraper/run (scraper service)
    → discover top 5 CI insurers for CURRENT_COUNTRY
    → for each insurer: fetch URL → extract text → DeepSeek extracts plan data → save to Supabase
```

All scraped data goes directly into the Supabase `plans`, `insurers`, and `sources` tables. The compare page reads live from the DB — no static files.

### New files / key changes

| File | What changed |
|------|-------------|
| `scraper/app/scraper/discovery.py` | DeepSeek identifies top 5 CI insurers; DuckDuckGo searches for their PDF brochure URLs |
| `scraper/app/scraper/engine.py` | Full SQLAlchemy pipeline: discover → load sources → change-detect → download → extract → validate → upsert plans |
| `scraper/app/scraper/downloader.py` | Uses **Jina Reader** (`r.jina.ai`) to fetch any URL — handles JS-heavy sites and PDFs transparently |
| `scraper/app/scraper/extractor.py` | Decodes Jina's clean markdown output; BeautifulSoup kept for mock sources only |
| `scraper/app/scraper/converter.py` | DeepSeek LLM extracts structured plan data from page text; debug logging added |
| `scraper/app/scraper/validator.py` | Coerces `null` LLM fields to safe defaults so Pydantic never rejects a partial extraction |
| `scraper/app/storage/database.py` | SQLAlchemy models for all tables; `session.merge()` for idempotent plan upserts |
| `web/src/components/compare/run-scraper-button.tsx` | New "Refresh data" button with spinner and result message |
| `web/src/lib/seed.ts` | Seeds **users only** — insurers/plans/sources owned by scraper |
| `web/src/lib/schema.ts` | Added `country` column to insurers, plans, sources |
| `web/drizzle/0001_add_country.sql` | Migration: adds country column (default `'Singapore'`) |
| `web/drizzle/0002_country_sg_to_singapore.sql` | Migration: renames existing `'SG'` values to `'Singapore'` |

### Removed
- `scraper/app/routers/mock.py` — mock brochure router deleted
- `scraper/mock_brochure/` — deleted entirely
- Static JSON seed data for insurers/plans/sources — scraper populates these now

---

## Current Blocker: PDF URL Discovery

The pipeline fetches and extracts data correctly **when given a working PDF URL**. The remaining problem is automatically finding those PDF URLs.

### What we tried

| Approach | Result |
|----------|--------|
| DeepSeek guesses URLs | Hallucinated/wrong URLs, 404s |
| Playwright scraping product pages | Bot-blocked, 629–2818 chars returned |
| `playwright-stealth` | Still minimal content |
| Jina Reader on product pages | Gets 20k+ chars but no pricing — product pages only have "Get a Quote" buttons, not premium tables |
| PDF link finder in Jina markdown | Pages don't link to PDFs in their HTML |
| Jina Search (`s.jina.ai`) | Requires paid plan — 401 Unauthorized |
| DuckDuckGo (`ddgs`) | Just deployed, not yet confirmed working |

### Root cause
Insurer **product pages** are marketing pages — they don't have premium tables. The actual pricing data (coverage amounts, premium tables, illnesses covered) only exists in **PDF brochures** hosted on the insurer's website. We need the right PDF URLs.

### What's likely to work next

**Option A — DuckDuckGo search (just deployed, untested):**
`discovery.py` now searches DDG for `"{insurer name} critical illness brochure filetype:pdf"` → extracts `.pdf` URL from results. Run `docker compose up --build` and trigger scraper to test.

**Option B — Hardcode PDF URLs (most reliable, recommended if DDG fails):**
Create `scraper/app/scraper/sources_config.json` with verified PDF URLs per insurer. One-time manual research, then the AI extraction pipeline runs fully automatically forever. Example structure:
```json
[
  {
    "insurerId": "aia-singapore",
    "insurerName": "AIA Singapore",
    "planName": "AIA Critical Illness",
    "planId": "aia-ci",
    "brochureUrl": "https://www.aia.com.sg/.../brochure.pdf",
    "website": "https://www.aia.com.sg",
    "country": "Singapore"
  }
]
```

---

## Environment Setup

```bash
# .env (root) — already configured for Supabase
DATABASE_URL=postgresql://postgres.otjcvcoeiasmaubadcmp:...@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
DEEPSEEK_API_KEY=sk-...
JINA_API_KEY=jina_43908f00eedd49f3b4ed7ab318328adbv5-...   # for r.jina.ai content fetching
CURRENT_COUNTRY=Singapore
```

```bash
# Start everything
docker compose up --build

# Trigger scraper manually
curl -X POST http://localhost:8100/scraper/run

# Watch logs
docker compose logs scraper -f
```

## DB Reset (Supabase SQL Editor)
```sql
-- Wipe all scraped data (keeps users)
TRUNCATE TABLE audit_entries, scraper_runs, thread_messages, threads, sources, plans, insurers RESTART IDENTITY CASCADE;

-- Check what was scraped
SELECT plan_name, insurer_name, coverage_amount, illnesses_covered, scraped_at FROM plans ORDER BY scraped_at DESC;
SELECT trigger, started_at, sources_checked, sources_changed, errors FROM scraper_runs ORDER BY started_at DESC;
```

---

## Key Architecture Notes

- **Drizzle (web) owns the schema** — all migrations live in `web/drizzle/`. SQLAlchemy (scraper) maps to existing tables, emits no DDL.
- **`session.merge()`** is used for plan upserts — safe to trigger scraper multiple times concurrently.
- **Content hash** is stored from the httpx response (not Playwright/Jina output) so `has_changed()` comparison stays consistent run-to-run.
- **Jina API key** covers `r.jina.ai` (content fetching) but NOT `s.jina.ai` (search) — search needs the `ddgs` package or a paid Jina plan.
- **`CURRENT_COUNTRY`** env var controls which market is scraped. Change to `"Malaysia"`, `"Australia"` etc. to switch markets — discovery and filtering are both country-aware.
