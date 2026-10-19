import { testDb } from "./setup";
import { NextRequest } from "next/server";
import { insertThread, getThreadById } from "@/lib/db";
import * as schema from "@/lib/schema";
import type { Thread, ExtractedQuote } from "@/lib/types";

// ─── mock the session ─────────────────────────────────────────────────────────
// The route handlers call auth() from @/lib/auth. We control the returned
// session per-test so we can exercise ownership scoping (user A vs user B).
let currentSession: { user: { id: string; tier: string } } | null = null;

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(async () => currentSession),
}));

// extract_quote hits DeepSeek via extractQuoteFromThread; stub it so the quote
// route is testable offline. The CRM tests below don't exercise it, but the
// import must resolve without a key.
jest.mock("@/lib/ai", () => ({
  extractQuoteFromThread: jest.fn(async () => ({
    coverageAmount: 100000,
    annualPremium: 1200,
  })),
}));

// Route handlers under test (imported after the mocks above).
import { GET, PATCH } from "@/app/api/crm/threads/[threadId]/route";
import { POST as comparisonPOST } from "@/app/api/crm/threads/[threadId]/quote/comparison/route";

const OWNER = "user_demo"; // premium user from the seed data
const OTHER = "user_other";

function params(threadId: string) {
  return { params: Promise.resolve({ threadId }) };
}

function patchRequest(threadId: string, body: unknown) {
  return new NextRequest(`http://localhost/api/crm/threads/${threadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getRequest(threadId: string) {
  return new NextRequest(`http://localhost/api/crm/threads/${threadId}`);
}

function postRequest(threadId: string) {
  return new NextRequest(
    `http://localhost/api/crm/threads/${threadId}/quote/comparison`,
    { method: "POST" }
  );
}

let counter = 0;
function makeThread(userId: string, overrides: Partial<Thread> = {}): Thread {
  const now = new Date().toISOString();
  const id = `thread_test_${counter++}`;
  return {
    id,
    userId,
    insurerId: "aia",
    insurerName: "AIA",
    subject: "CI plan enquiry",
    status: "sent",
    messages: [
      {
        id: `msg_${id}`,
        direction: "outbound",
        from: "user-demo@relay.fineprint.local",
        to: "agent@aia.example",
        subject: "CI plan enquiry",
        body: "Could you share coverage and premium details?",
        timestamp: now,
        aiGenerated: true,
        flagged: false,
      },
    ],
    extractedQuote: null,
    riskFlags: [],
    addedToComparison: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const QUOTE: ExtractedQuote = {
  coverageAmount: 100000,
  annualPremium: 1200,
  waitingPeriod: "90 days",
  exclusionsNoted: ["Pre-existing conditions"],
  riderOptions: ["Early-stage rider"],
  validUntil: "2026-12-31",
  extractedAt: new Date().toISOString(),
};

beforeAll(async () => {
  // threads.user_id is a FK to users.id, so the "other" owner must exist as a
  // real row before we can seed threads under it.
  await testDb
    .insert(schema.users)
    .values({
      id: OTHER,
      email: "other@fineprint.local",
      passwordHash: "x",
      name: "Other User",
      tier: "premium",
      maskedInbox: "other@relay.fineprint.local",
      onboarded: true,
      shareAge: false,
      shareGender: false,
      shareSmokerStatus: false,
      shareCoverageNeeds: false,
      shareBudgetRange: false,
      shareOccupation: false,
      shareHealthHistory: false,
      shareIncome: false,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing();
});

beforeEach(() => {
  currentSession = { user: { id: OWNER, tier: "premium" } };
});

describe("CRM thread route — ownership scoping", () => {
  it("GET does not return a thread owned by another user (404)", async () => {
    const thread = makeThread(OTHER);
    await insertThread(thread);

    currentSession = { user: { id: OWNER, tier: "premium" } };
    const res = await GET(getRequest(thread.id), params(thread.id));

    expect(res.status).toBe(404);
  });

  it("GET returns a thread the current user owns", async () => {
    const thread = makeThread(OWNER);
    await insertThread(thread);

    const res = await GET(getRequest(thread.id), params(thread.id));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.thread.id).toBe(thread.id);
  });

  it("PATCH cannot update a thread owned by another user (404)", async () => {
    const thread = makeThread(OTHER);
    await insertThread(thread);

    currentSession = { user: { id: OWNER, tier: "premium" } };
    const res = await PATCH(
      patchRequest(thread.id, { status: "closed" }),
      params(thread.id)
    );
    expect(res.status).toBe(404);

    // The other user's thread must be untouched.
    const stored = await getThreadById(thread.id, OTHER);
    expect(stored?.status).toBe("sent");
  });
});

describe("CRM thread route — status update happy path", () => {
  it("PATCH status -> closed persists and returns the updated thread", async () => {
    const thread = makeThread(OWNER);
    await insertThread(thread);

    const res = await PATCH(
      patchRequest(thread.id, { status: "closed" }),
      params(thread.id)
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.thread.status).toBe("closed");

    const stored = await getThreadById(thread.id, OWNER);
    expect(stored?.status).toBe("closed");
  });
});

describe("CRM comparison route — quote guards", () => {
  it("returns 400 when no quote has been extracted yet", async () => {
    const thread = makeThread(OWNER, { extractedQuote: null });
    await insertThread(thread);

    const res = await comparisonPOST(postRequest(thread.id), params(thread.id));
    expect(res.status).toBe(400);
  });

  it("adds a quote once, then returns 409 on a duplicate add", async () => {
    const thread = makeThread(OWNER, { extractedQuote: QUOTE });
    await insertThread(thread);

    const first = await comparisonPOST(postRequest(thread.id), params(thread.id));
    expect(first.status).toBe(200);

    const stored = await getThreadById(thread.id, OWNER);
    expect(stored?.addedToComparison).toBe(true);

    const second = await comparisonPOST(postRequest(thread.id), params(thread.id));
    const data = await second.json();
    expect(second.status).toBe(409);
    expect(String(data.error).toLowerCase()).toContain("already");
  });

  it("does not add a quote for a thread owned by another user (404)", async () => {
    const thread = makeThread(OTHER, { extractedQuote: QUOTE });
    await insertThread(thread);

    currentSession = { user: { id: OWNER, tier: "premium" } };
    const res = await comparisonPOST(postRequest(thread.id), params(thread.id));
    expect(res.status).toBe(404);
  });
});
