# Handoff: PR #7 (Supabase Auth + related work) → next agent

**From:** Kiro (Jeff's lane) · **Date:** 2026-10-20 · **For:** the next AI agent (Copilot) continuing this work

This captures the state of the in-flight **`feat/supabase-auth`** branch / **PR #7** and the
outreach-email work, so you can continue without re-discovering everything.

---

## TL;DR — where things stand

- **`main`** is at `1845a17`, healthy and runnable. It has: DeepSeek AI, Postgres (Supabase) storage,
  the app icon/logo, profile-driven comparison, CI, `.env.example` (incl. Supabase + optional SMTP docs).
- **PR #7** (`feat/supabase-auth`, head `43491a7`) is **OPEN (draft), NOT merged.** It replaces NextAuth
  with Supabase Auth and carries several stacked features (see commit list below). It builds clean and
  tests pass **keyless**, but needs a **live smoke test** before merge.
- The only active worktree is `/Users/leeguanfeng/Documents/Github/Assura/.worktrees/supabase-auth`
  (branch `feat/supabase-auth`). Run/test the branch from there. It has its own `.env` (copied from the
  repo-root `.env`; gitignored).
- **Do NOT merge PR #7 until the user confirms a live login + outreach smoke test passes.** It replaces
  the working auth on `main`; merging unverified risks breaking the single most important demo step (login).

---

## Commits on PR #7 (ahead of main), newest first

| Commit | What |
|---|---|
| `43491a7` | **Outreach emails in the user's first-person voice** (signed with their name; NOT "on behalf of a customer") + **optional real SMTP** delivery (defaults to Mailpit). |
| `f81ca3b` | **Fix:** `seed-auth.ts` now `process.exit(0)`s so the one-shot `db-migrate` container terminates (it was hanging → web/scraper never started). |
| `9a67f91` | **Self-service delete account** (topbar menu → typed-DELETE dialog → cascade delete + Supabase identity delete + sign out). |
| `3859bc8` | **Production Docker** for the whole stack: `web/Dockerfile.prod` (standalone), `docker-compose.prod.yml`, `./dev.sh up-prod`. Default `up` (dev/hot-reload) unchanged. |
| `ac79e95` | **Toasts** via `sonner` + `ToastOnParam` (fires from `?toast=` redirect param). Signup/login/upgrade/logout/delete. |
| `3d9e1e5` | **Fix (critical):** edge auth verifies the Supabase JWT via **JWKS (ES256/RS256)**, NOT HS256. The project signs ES256, so HS256 always failed → login redirect loop. This is the real login fix. |
| `b0c1aff` | TASK.MD log entry. |
| `653ed5b` | The base Supabase Auth migration (NextAuth v5 → Supabase; `auth()` facade; app `users` table stays source of truth, linked by `auth_uid`). |

---

## The Supabase Auth design (how it works — don't relitigate)

- **Bridging (Option A):** the app's Drizzle `users` table stays the source of truth (TEXT ids like
  `user_demo`, tier, maskedInbox, onboarded, consent, all FKs). Supabase Auth ONLY verifies credentials.
  Link via a nullable `users.auth_uid` column (back-filled on first login; email fallback).
- **`auth()` facade** (`web/src/lib/auth.ts`) returns `{ user: { id, tier, maskedInbox, onboarded,
  email, name } } | null` — the SAME shape the ~16 `auth()` call sites and `crm-api.test.ts`'s mock
  expect, so call sites didn't change.
- **Edge gating** (`web/src/proxy.ts` — renamed from middleware.ts per Next 16): reads tier from the
  Supabase access token, verified LOCALLY against Supabase's JWKS with `jose` (ES256/RS256). No DB at the
  edge, no network `getUser()` round-trip. Keyless-safe (missing env → signed-out, build doesn't crash).
- **Supabase clients** under `web/src/lib/supabase/`: `client.ts` (browser/anon), `server.ts`
  (cookie-bound SSR), `admin.ts` (service-role, server-only), `env.ts` (guarded readers, never throw at
  import), `ensure-demo-user.ts` (idempotent demo identity + `syncAuthMetadata`).
- Server actions in `web/src/app/_actions/auth.ts`: `loginAction`, `signupAction`, `demoLoginAction`,
  `logoutAction`, `upgradeToPremiumAction`, `deleteAccountAction`. All redirect with `?toast=<key>`.

---

## Environment (what the user must set — in BOTH repo-root `.env` and the worktree `.env`)

Already set by the user: `AUTH_SECRET`, `INTERNAL_API_SECRET`, `DEEPSEEK_API_KEY`, `DATABASE_URL`
(Supabase pooler), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable),
`SUPABASE_SERVICE_ROLE_KEY` (secret).

- **`NEXT_PUBLIC_SUPABASE_URL` must be the BARE host** `https://<ref>.supabase.co` — NO `/rest/v1/` path
  (a path caused a 404 "Invalid path" on signup; already fixed in the user's `.env`).
- **`SUPABASE_JWT_SECRET` is NOT needed** — edge uses JWKS/ES256 now. Documented as unused in `.env.example`.
- **Optional real SMTP** (for outreach to actually email a real inbox): `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`. Empty `SMTP_HOST` = Mailpit sandbox (nothing leaves the
  machine). The user is setting up **Brevo** (smtp-relay.brevo.com:587; needs a verified sender + an SMTP
  key). `.env.example` documents it. Code: `scraper/app/email_relay/relay.py` (auth+STARTTLS when
  SMTP_HOST set) + `scraper/app/config.py`.

---

## How to run / test (from the worktree)

```bash
cd /Users/leeguanfeng/Documents/Github/Assura/.worktrees/supabase-auth
# ensure .env exists here (copied from repo root; has all keys)
./dev.sh up-prod     # whole stack in Docker, web BUILT (no live recompiling)
```
- App: http://localhost:3000 · Mailpit: http://localhost:8025 · login demo@fineprint.local / demo1234
- `db-migrate` runs migrate→seed→seed-auth then MUST exit (f81ca3b fix). If it hangs, a script left a
  connection open — add `process.exit(0)`.

Keyless build/test anywhere: `cd web && npm run build && npm test` (both pass; ~53 tests). The only lint
error is a PRE-EXISTING one in `web/src/hooks/use-plans.ts` (Dominic's) — leave it.

---

## OUTSTANDING — what still needs doing (continue here)

1. **LIVE SMOKE TEST (blocking merge).** With the stack running + real keys:
   - Register a new account → should show a success toast and land in the app (NO redirect loop — if it
     loops back to /login, the JWKS/ES256 verify is failing; re-check `NEXT_PUBLIC_SUPABASE_URL` + that
     the project is ES256).
   - Confirm premium gating (a premium signup reaches /onboarding, /outreach, /crm). NOTE: tier rides in
     the token's `app_metadata`; a freshly-created admin user may lack it → check `syncAuthMetadata` ran
     on signup. If premium users get bounced to /upgrade, that's the thing to debug.
   - Delete-account flow (topbar menu → type DELETE) removes the user everywhere and signs out.
2. **Outreach real-email test (Brevo).** Once the user adds the `SMTP_*` Brevo creds: draft → approve →
   send to AIA (its agentEmail was set to `2603062.sit@gmail.com` in `seed/insurers.json` for this test —
   REMEMBER to revert that to a demo address before the real demo). Check the inbox (+ spam). Confirm the
   email reads first-person as the user, signed with their name, with the AI-disclosure footer, and
   masked relay as Reply-To.
3. **Then merge PR #7** (user's go-ahead): `gh pr ready 7 && gh pr merge 7 --merge --delete-branch`,
   then remove the worktree. After merge, `./dev.sh up-prod` works from the main checkout.
4. **Docker base image:** there's an uncommitted `web/Dockerfile` edit (`node:20`→`node:22`) from the
   user's Docker debugging — NOT mine; confirm with the user whether to keep/commit it.
5. **Still-floating uncommitted `web/src/lib/seed.ts`** change in the worktree — not mine; verify with the
   user before committing.

---

## Conventions / guardrails to respect (from AGENTS.md)

- Lanes: Jeff = AI/outreach/CRM; Marcus = scraper/data; Dominic = web/auth/UI; Caitlyn = docs. Dominic is
  done pushing, so auth work is unblocked, but avoid gratuitous churn in others' files.
- Security is graded 30%: keep the policy engine, PII blocker, **audit hash chain** (append-only — NEVER
  mutate/delete audit rows; delete-account deliberately preserves them), and quarantine reader intact.
- Factual comparison only — never financial advice / "buy this". Every outreach email keeps an
  AI-assistance disclosure (now a footer) — do NOT fully remove it (compliance story).
- `.agents/` is gitignored (agent scratch). `.env` is gitignored. Never commit secrets.
- Update `TASK.MD` (append-only) when you finish meaningful work.

## Key files

| Area | Files |
|---|---|
| Auth facade / clients | `web/src/lib/auth.ts`, `web/src/lib/supabase/*`, `web/src/proxy.ts` |
| Auth actions | `web/src/app/_actions/auth.ts` |
| Delete account | `web/src/components/account/delete-account-dialog.tsx`, `web/src/lib/db.ts` (`deleteUserCascade`), topbar |
| Toasts | `web/src/components/toast-on-param.tsx`, root layout, `(app)`/`(public)` layouts |
| Outreach draft (first-person) | `web/src/lib/ai.ts` (`draftOutreachEmail`), `web/src/app/api/outreach/draft/route.ts` |
| Real SMTP | `scraper/app/email_relay/relay.py`, `scraper/app/config.py`, `docker-compose.yml` (scraper SMTP_* env) |
| Prod Docker | `web/Dockerfile.prod`, `docker-compose.prod.yml`, `dev.sh` (`up-prod`) |
| PR | #7 → https://github.com/caitlynwee/Assura/pull/7 |
