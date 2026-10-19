PROJECT: Asurra, an AI insurance comparison and outreach agent
CONTEXT: Built for the 2026 Shenzhen FinTechathon (International Track), Topic D (Insurance Assistant), theme "AI as a Financial Participant".
Judging: task completion 40%, security and compliance 30%, innovation and interaction 30%.
Deadline: 20 Oct 2026, 23:59 Singapore time.
Demo only: simulated accounts and sandbox email, no real money or real insurers.

WHAT IT IS
Insurers publish brochures but keep personalised quotes and in-depth answers behind their agents. Fineprint is a "reverse CRM" for customers:
1. It compares public plan data from brochures (Level 1).
2. With the user's approval, an AI emails insurers on the user's behalf to collect personalised details (Level 2).
3. It tracks every conversation in a built-in CRM and puts the extracted quotes back into the comparison.
Scope: one category only, critical illness, about 10-15 plans from about 5 insurers.

THREE DELIVERABLES
1. Website
   - Public: homepage (pitch, how it works, Free vs Premium, login) and login (one-click demo login).
   - Logged in: full plan comparison (filters, sorting, source link and "data as of" date per plan) and plan Q&A chat whose answers cite the brochure.
   - Premium (assume the demo user is premium, no payments):
     - Onboarding: email only, consent checkboxes for what may be shared, masked inbox address shown.
     - Outreach: pick up to 5 insurers and question templates, AI drafts, user edits and approves.
     - CRM: threads with statuses (Draft, Awaiting approval, Sent, Replied, Info received, Flagged, Closed), extracted quote fields, risk flags, close thread, "add quote to comparison".
     - Activity log page with a "Verify chain" button.
2. Scraper
   - Cron job at 00:00 SGT plus a "Run now" button.
   - Checks each source in sources.json (ETag or Last-Modified, else SHA-256 hash).
   - If changed: download a versioned copy, extract text, convert to the plan schema with a no-tools LLM call, validate, send to the backend, add a change note and "Updated" badge.
   - Public pages only, robots.txt respected, rate-limited. A failed scrape never deletes the last good data.
   - Demo trick: one source is a local mock brochure page we can edit live.
3. Outreach server
   - Holds NO user credentials.
   - Sends from a per-user relay address (masked inbox) to Mailpit, a local sandbox. Nothing leaves the machine.
   - Every email starts by disclosing it is an AI assistant writing for a customer.
   - Shares only what the user ticked in onboarding. Never shares name, real email, phone, NRIC, health or income.
   - Limits: max 5 insurers per request, 1 follow-up per thread per 48h, 20 emails per user per day.
   - A script replies as 5 simulated insurer personas: helpful (full quote), slow (replies after a follow-up), pushy ("sign today"), data-grabber (asks for NRIC and medical history), injector (hidden "ignore previous instructions" text).

SECURITY DESIGN (30% of the score, so build it properly)
- The AI only requests actions. A policy engine in plain backend code decides, denies by default, and logs every decision.
- Tiers: 0 read, 1 advise and draft (premium, no side effects), 2 send with explicit user approval, 3 blocked for the AI (share NRIC, health, income or phone; agree to buy; book calls), which the AI must escalate to the user.
- Quarantined reader: all outside text (insurer emails, scraped pages) is parsed by an LLM call with no tools that returns fixed JSON only. The agent that sends emails never sees raw outside text.
- Personal-data blocker: outgoing emails are scanned for NRIC patterns, phone numbers and health keywords and blocked if found.
- Audit log: append-only audit.jsonl where each line stores the SHA-256 hash of the previous line. The Verify button re-checks the chain.
- Known-risk list (for the self-assessment report): wrong AI plan facts, prompt injection, stale scraped data, JSON storage not production-grade, possible financial-advice classification (so factual comparison only, never "buy this"), site terms of use, relay email spoofing, demo-only login.

TECH AND DATA
- Storage: local JSON files by decision (demo speed), with guardrails: the backend is the only writer, atomic saves (temp file then rename), a seed/ folder and a reset script.
- Files: users.json, plans.json, sources.json, threads.json, insurers.json, plus audit.jsonl and scraper_runs.jsonl.
- Repo structure: monorepo with /web (Next.js) and /scraper (Python) sub-folders.
- Frontend + backend API: Next.js (App Router). API routes handle all business logic. Auth via NextAuth.js (Auth.js v5) with a Credentials provider — real JWT sessions, one demo user hardcoded, no OAuth needed.
- Background jobs (scraper, relay, reply simulator): separate Python server in /scraper, communicates with /web via internal HTTP. Not combined into the Next.js process.
- Sandbox email: Mailpit (local, nothing leaves the machine). Needs to be installed before demo.
- Required tests: policy engine, personal-data blocker, hash chain, change detection.

DEMO FLOW (under 4 minutes, doubles as the demo video)
Home, then Compare and filter, then cited Q&A, then Onboarding (masked inbox), then Outreach (an NRIC typed into the notes is blocked, then approve), then CRM (helpful quote extracted, pushy flagged, data-grabber escalated, injection ignored), then edit the mock brochure and press Run now ("Updated" badge), then Verify chain passes, and a tampered copy fails.

OUT OF SCOPE
Payments, real insurers, other categories, claims guidance, buying a policy, mobile app, Gmail or Outlook sign-in.

OPEN ITEMS
- Critical illness confirmed as the one category.
- Framework confirmed: Next.js + Auth.js v5 (web), Python scraper server (background jobs).
- Scraper targets: real insurer websites for Level 1 plan data and agent contact emails. sources.json to be populated with actual URLs during build.
- Mock brochure page: a locally-served HTML page (within /scraper or /web/public) that can be edited live during the demo to trigger the "Updated" badge.
- Business side (market numbers, pitch deck, judge Q&A) is being handled separately by the business co-founder.