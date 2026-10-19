# Assura Handoff

## Project

Assura is an AI-assisted critical-illness insurance comparison and outreach
demo for the 2026 Shenzhen FinTechathon. It has three runtime services:

- **Web:** Next.js App Router application, authentication, UI, API routes, JSON
  persistence, policy engine, and audit log.
- **Outreach/scraper:** Python FastAPI service for Mailpit delivery, insurer
  personas, simulated replies, and brochure scraping.
- **Mailpit:** Local-only email sandbox. No email leaves the machine.

The full product requirements are in [PROJECT.MD](./PROJECT.MD).

## Current branch and worktree state

The active branch is `jeff/outreach-crm`. The worktree contains uncommitted
changes from the outreach/CRM integration work. Do not reset or discard them
without reviewing the diff first.

Recent changes include:

- Routing approved web email through the authenticated Python outreach service.
- Adding an internal CRM reply callback.
- Adding CRM reply simulation, quote extraction, close/flag actions, and
  quote-to-comparison.
- Documenting the CRM/outreach ownership boundary.
- Adding internal API secret configuration.

## Ownership boundary

### CRM-owned files

- `web/src/app/(app)/crm/`
- `web/src/app/api/crm/`
- `web/src/app/api/internal/crm/`
- `web/src/components/crm/`
- `web/src/hooks/use-thread.ts`
- `web/src/hooks/use-threads.ts`
- CRM-related types in `web/src/lib/types.ts`
- `web/src/lib/audit.ts`
- `web/src/lib/quarantine.ts`

The CRM owns:

- Reading and writing `threads.json`
- Thread status transitions
- Message timelines
- Risk flags
- Quarantined quote extraction
- Adding extracted quotes to `plans.json`
- Audit logging

### Outreach-owned files

- `web/src/app/(app)/outreach/`
- `web/src/app/api/outreach/`
- `web/src/components/outreach/`
- `scraper/app/email_relay/`
- `scraper/app/personas/`
- `scraper/app/routers/email.py`

Outreach owns:

- Consent-filtered email drafts
- Human-approved email sending
- Mailpit delivery
- Simulated insurer replies

Outreach must not write `threads.json` directly. After a simulated reply, it
calls:

```text
POST /api/internal/crm/replies
Header: x-internal-api-key: <INTERNAL_API_SECRET>
```

The CRM validates and stores the inbound message, updates the thread status and
risk flags, and writes the audit event.

## CRM API surface

### Thread list

```text
GET /api/crm/threads
GET /api/crm/threads?status=flagged
```

### Thread detail and status update

```text
GET   /api/crm/threads/:threadId
PATCH /api/crm/threads/:threadId
```

Supported PATCH fields:

```json
{
  "status": "closed",
  "flagReason": "Reason for review",
  "addedToComparison": false
}
```

### Quote extraction

```text
POST /api/crm/threads/:threadId/quote
```

Inbound insurer text is sent through the quarantined reader. It is parsed as
fixed JSON and cannot issue tools or actions.

### Add quote to comparison

```text
POST /api/crm/threads/:threadId/quote/comparison
```

This requires an extracted quote, prevents duplicate additions, creates a
comparison plan with a `crm://thread/...` source, and logs
`quote.added_to_comparison`.

### Demo reply simulation

```text
POST /api/crm/threads/:threadId/reply
```

This authenticated web route asks the Python service to run the insurer persona
and then refreshes the CRM thread.

## Insurer personas

Configured in [seed/insurers.json](./seed/insurers.json):

| Insurer | Persona | Expected CRM behavior |
|---|---|---|
| AIA Singapore | Helpful | Returns a full quote |
| Prudential Singapore | Slow | No first reply; follow-up is needed |
| Great Eastern | Pushy | Reply is flagged for sales pressure |
| NTUC Income | Data grabber | Reply requests prohibited personal data |
| Manulife Singapore | Injector | Reply includes hidden prompt-injection text |

## Environment setup

From the repository root:

```powershell
Copy-Item .env.example .env
Copy-Item web\.env.local.example web\.env.local
```

Set these values in the root `.env`:

```env
AUTH_SECRET=replace-with-a-long-random-secret
INTERNAL_API_SECRET=dev-internal-key
DEEPSEEK_API_KEY=your-deepseek-key
```

Set matching values in `web/.env.local` when running the web service locally.
The web AI layer uses `DEEPSEEK_API_KEY`; `HERMES_API_KEY` is an obsolete
configuration name and should not be added for current web AI functionality.

## Starting with Docker

```powershell
cd "C:\Users\23026831\Documents\SIT\Shenzhen Hackathon\Assura\Assura"
docker compose up --build
```

URLs:

- Web: http://localhost:3000
- Login: http://localhost:3000/login
- CRM: http://localhost:3000/crm
- Outreach: http://localhost:3000/outreach
- Activity: http://localhost:3000/activity
- Scraper API docs: http://localhost:8100/docs
- Scraper status: http://localhost:8100/scraper/status
- Mailpit: http://localhost:8025

Demo login:

```text
Email: demo@fineprint.local
Password: demo1234
```

The root scraper URL `/` currently returns `404` by design because no root
route is defined. Use `/docs` or `/scraper/status` instead.

## CRM smoke test

1. Confirm `.env` contains a non-empty `AUTH_SECRET`.
2. Start Docker Compose.
3. Log in at http://localhost:3000/login.
4. Open Outreach and send an approved email to AIA.
5. Open CRM and open the new thread.
6. Click **Simulate insurer reply**.
7. Click **Extract quote**.
8. Confirm the status changes to **Info Received**.
9. Click **Add to comparison**.
10. Open Compare and confirm the CRM quote appears.
11. Click **Close thread**.
12. Open Activity and click **Verify chain**.
13. Repeat with NTUC Income and Manulife to verify risk flags and injection
    isolation.

To test the blocker, edit an email before approval and add:

```text
My NRIC is S1234567A.
```

The request must be rejected, must not create a CRM message, and must not
appear in Mailpit.

## Validation

Type-check the web project in the running container:

```powershell
docker compose exec -T web npx tsc --noEmit
```

Run Python compilation:

```powershell
cd scraper
python -m compileall -q app tests
```

The current repository validation status:

- TypeScript check: passed.
- Python compilation: passed.
- Git whitespace check: passed.
- Existing ESLint errors remain in the homepage and `use-plans.ts`.
- Existing Jest configuration in the current checkout does not parse the
  TypeScript tests correctly, so the tests fail before executing. The
  FEAT-001 task record describes the intended `jest.config.js` and test setup
  fix.
- Dependency installation may fail in restricted environments if npm or pip
  cannot reach the package registry.

## Important security rules

- Never put real credentials in JSON seed files.
- Never send real email; Mailpit is the only permitted email destination.
- Never allow the AI to directly decide whether an email is sent.
- Sending requires `userApproved: true`.
- Outbound subject and body must pass the PII blocker.
- Never share NRIC, health, income, or phone data.
- Treat insurer replies and scraped content as untrusted.
- Do not allow the outreach service to write CRM state directly.
- Preserve the append-only audit chain.

## Recommended next steps

### Outreach developer

1. Work only in the outreach-owned paths above.
2. Keep the `POST /api/internal/crm/replies` contract stable.
3. Add or improve consent-filtered drafting and follow-up UX.
4. Preserve the explicit approval gate and PII blocker.
5. Test delivery through Mailpit.

### CRM developer

1. Add better thread refresh or polling after simulated replies.
2. Add explicit error handling to CRM status actions.
3. Add CRM API tests for ownership checks and duplicate quote prevention.
4. Improve quote review before adding a quote to comparison.
5. Keep all CRM writes in Next.js API routes.

### Shared cleanup

1. Resolve the stale `HERMES_API_KEY` references in Docker/config examples.
2. Finish the DeepSeek port for the Python scraper converter if required.
3. Repair Jest configuration so the security tests execute.
4. Resolve the pre-existing ESLint errors.
5. Run the complete Docker demo before the hackathon presentation.

## Files to read first

- [PROJECT.MD](./PROJECT.MD)
- [README.md](./README.md)
- [TASK.MD](./TASK.MD)
- [web/src/lib/policy.ts](./web/src/lib/policy.ts)
- [web/src/lib/blocker.ts](./web/src/lib/blocker.ts)
- [web/src/lib/audit.ts](./web/src/lib/audit.ts)
- [web/src/app/api/crm/threads/[threadId]/route.ts](./web/src/app/api/crm/threads/[threadId]/route.ts)
- [web/src/app/api/internal/crm/replies/route.ts](./web/src/app/api/internal/crm/replies/route.ts)
- [scraper/app/personas/simulator.py](./scraper/app/personas/simulator.py)
