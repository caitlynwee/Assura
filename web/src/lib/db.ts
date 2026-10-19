/**
 * db.ts — Drizzle-backed async data layer (PostgreSQL).
 *
 * Replaces the old synchronous JSON-file layer. The web backend is still the
 * only writer. The Drizzle client is created lazily from process.env.DATABASE_URL
 * via the postgres.js driver.
 *
 * Do NOT import this module into edge code (middleware / auth-routing.ts) — it
 * pulls in a Node Postgres driver. auth.ts (Node runtime) is the correct home
 * for DB-backed lookups.
 *
 * Tests inject a pglite-backed Drizzle instance via setDb(); see
 * src/__tests__/setup.ts.
 */

import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { eq, and, desc, inArray } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";
import type {
  User,
  Insurer,
  Plan,
  Source,
  Thread,
  ThreadMessage,
  ScraperRun,
  ConsentFlags,
} from "./types";

// The Drizzle instance type is intentionally loose so a pglite-backed instance
// (same schema, different driver) can be injected in tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;

let dbInstance: Database | null = null;
let sqlClient: ReturnType<typeof postgres> | null = null;

/** Inject a Drizzle instance (used by tests with a pglite driver). */
export function setDb(db: Database): void {
  dbInstance = db;
}

/** Lazily create the postgres.js-backed Drizzle client from DATABASE_URL. */
export function getDb(): Database {
  if (dbInstance) return dbInstance;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Point it at a PostgreSQL instance before using the data layer."
    );
  }
  sqlClient = postgres(url);
  dbInstance = drizzlePostgres(sqlClient, { schema });
  return dbInstance;
}

// ─── row ↔ domain mappers ─────────────────────────────────────────────────────

type UserRow = typeof schema.users.$inferSelect;
type ThreadRow = typeof schema.threads.$inferSelect;
type MessageRow = typeof schema.threadMessages.$inferSelect;

function rowToUser(row: UserRow): User {
  const consent: ConsentFlags = {
    shareAge: row.shareAge,
    shareGender: row.shareGender,
    shareSmokerStatus: row.shareSmokerStatus,
    shareCoverageNeeds: row.shareCoverageNeeds,
    shareBudgetRange: row.shareBudgetRange,
    shareOccupation: row.shareOccupation,
    shareHealthHistory: row.shareHealthHistory,
    shareIncome: row.shareIncome,
  };
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    name: row.name,
    tier: row.tier as User["tier"],
    maskedInbox: row.maskedInbox,
    onboarded: row.onboarded,
    consent,
    createdAt: row.createdAt,
    ...(row.authUid != null ? { authUid: row.authUid } : {}),
  };
}

function rowToMessage(row: MessageRow): ThreadMessage {
  return {
    id: row.id,
    direction: row.direction as ThreadMessage["direction"],
    from: row.from,
    to: row.to,
    subject: row.subject,
    body: row.body,
    timestamp: row.timestamp,
    aiGenerated: row.aiGenerated,
    flagged: row.flagged,
    ...(row.flagReason != null ? { flagReason: row.flagReason } : {}),
  };
}

function rowToThread(row: ThreadRow, messages: ThreadMessage[]): Thread {
  return {
    id: row.id,
    userId: row.userId,
    insurerId: row.insurerId,
    insurerName: row.insurerName,
    subject: row.subject,
    status: row.status as Thread["status"],
    messages,
    extractedQuote: (row.extractedQuote as Thread["extractedQuote"]) ?? null,
    riskFlags: (row.riskFlags as string[]) ?? [],
    addedToComparison: row.addedToComparison,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── users ──────────────────────────────────────────────────────────────────

export async function getUsers(): Promise<User[]> {
  const rows = await getDb().select().from(schema.users);
  return rows.map(rowToUser);
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const users = await getUsers();
  return (
    users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null
  );
}

/** Resolve an app user by its linked Supabase auth uid, or null. */
export async function getUserByAuthUid(authUid: string): Promise<User | null> {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.authUid, authUid))
    .limit(1);
  return rows[0] ? rowToUser(rows[0]) : null;
}

/** Back-fill the Supabase auth uid onto an app user row (idempotent link). */
export async function linkAuthUid(
  appUserId: string,
  authUid: string
): Promise<void> {
  await getDb()
    .update(schema.users)
    .set({ authUid })
    .where(eq(schema.users.id, appUserId));
}

/**
 * Apply an onboarding update: consent flags, onboarded=true, optional maskedInbox.
 * Returns the updated user (or null if not found).
 */
export async function updateUserOnboarding(
  id: string,
  consent: ConsentFlags,
  maskedInbox?: string
): Promise<User | null> {
  const db = getDb();
  const existing = await getUserById(id);
  if (!existing) return null;

  const updates: Partial<UserRow> = {
    shareAge: consent.shareAge,
    shareGender: consent.shareGender,
    shareSmokerStatus: consent.shareSmokerStatus,
    shareCoverageNeeds: consent.shareCoverageNeeds,
    shareBudgetRange: consent.shareBudgetRange,
    shareOccupation: consent.shareOccupation,
    shareHealthHistory: consent.shareHealthHistory,
    shareIncome: consent.shareIncome,
    onboarded: true,
  };
  if (maskedInbox) updates.maskedInbox = maskedInbox;

  await db.update(schema.users).set(updates).where(eq(schema.users.id, id));
  return getUserById(id);
}

// ─── insurers ─────────────────────────────────────────────────────────────────

export async function getInsurers(): Promise<Insurer[]> {
  const rows = await getDb().select().from(schema.insurers);
  return rows as Insurer[];
}

export async function getInsurerById(id: string): Promise<Insurer | null> {
  const rows = await getDb()
    .select()
    .from(schema.insurers)
    .where(eq(schema.insurers.id, id))
    .limit(1);
  return (rows[0] as Insurer) ?? null;
}

// ─── plans ────────────────────────────────────────────────────────────────────

export async function getPlans(): Promise<Plan[]> {
  const rows = await getDb().select().from(schema.plans);
  return rows as Plan[];
}

// ─── sources ──────────────────────────────────────────────────────────────────

export async function getSources(): Promise<Source[]> {
  const rows = await getDb().select().from(schema.sources);
  return rows as Source[];
}

// ─── threads ──────────────────────────────────────────────────────────────────

async function messagesForThread(threadId: string): Promise<ThreadMessage[]> {
  const rows = await getDb()
    .select()
    .from(schema.threadMessages)
    .where(eq(schema.threadMessages.threadId, threadId))
    .orderBy(schema.threadMessages.ordering);
  return rows.map(rowToMessage);
}

export async function getThreadsByUser(userId: string): Promise<Thread[]> {
  const rows = (await getDb()
    .select()
    .from(schema.threads)
    .where(eq(schema.threads.userId, userId))) as ThreadRow[];
  const threads: Thread[] = [];
  for (const row of rows) {
    threads.push(rowToThread(row, await messagesForThread(row.id)));
  }
  return threads;
}

export async function getThreadById(
  threadId: string,
  userId: string
): Promise<Thread | null> {
  const rows = (await getDb()
    .select()
    .from(schema.threads)
    .where(
      and(eq(schema.threads.id, threadId), eq(schema.threads.userId, userId))
    )
    .limit(1)) as ThreadRow[];
  if (!rows[0]) return null;
  return rowToThread(rows[0], await messagesForThread(threadId));
}

/** Insert a brand new thread together with its first message. */
export async function insertThread(thread: Thread): Promise<void> {
  const db = getDb();
  await db.insert(schema.threads).values({
    id: thread.id,
    userId: thread.userId,
    insurerId: thread.insurerId,
    insurerName: thread.insurerName,
    subject: thread.subject,
    status: thread.status,
    extractedQuote: thread.extractedQuote,
    riskFlags: thread.riskFlags,
    addedToComparison: thread.addedToComparison,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  });
  for (let i = 0; i < thread.messages.length; i++) {
    await insertMessageRow(thread.id, thread.messages[i], i);
  }
}

async function insertMessageRow(
  threadId: string,
  message: ThreadMessage,
  ordering: number
): Promise<void> {
  await getDb()
    .insert(schema.threadMessages)
    .values({
      id: message.id,
      threadId,
      ordering,
      direction: message.direction,
      from: message.from,
      to: message.to,
      subject: message.subject,
      body: message.body,
      timestamp: message.timestamp,
      aiGenerated: message.aiGenerated,
      flagged: message.flagged,
      flagReason: message.flagReason ?? null,
    });
}

/** Append a message to an existing thread and bump its status/updatedAt. */
export async function appendThreadMessage(
  threadId: string,
  message: ThreadMessage,
  status: Thread["status"],
  updatedAt: string
): Promise<void> {
  const db = getDb();
  const existing = await db
    .select()
    .from(schema.threadMessages)
    .where(eq(schema.threadMessages.threadId, threadId));
  const ordering = existing.length;
  await insertMessageRow(threadId, message, ordering);
  await db
    .update(schema.threads)
    .set({ status, updatedAt })
    .where(eq(schema.threads.id, threadId));
}

/** Update mutable thread fields (status / comparison flag / quote / updatedAt). */
export async function updateThread(
  threadId: string,
  updates: Partial<
    Pick<
      Thread,
      "status" | "addedToComparison" | "extractedQuote" | "updatedAt"
    >
  >
): Promise<void> {
  await getDb()
    .update(schema.threads)
    .set(updates)
    .where(eq(schema.threads.id, threadId));
}

// ─── scraper_runs ─────────────────────────────────────────────────────────────

export async function getScraperRuns(): Promise<ScraperRun[]> {
  const rows = await getDb()
    .select()
    .from(schema.scraperRuns)
    .orderBy(schema.scraperRuns.startedAt);
  return rows as ScraperRun[];
}

// ─── audit_entries ────────────────────────────────────────────────────────────

/** The newest audit row's hash, or "0" if the chain is empty. */
export async function getLastAuditHash(): Promise<string> {
  const rows = await getDb()
    .select({ hash: schema.auditEntries.hash })
    .from(schema.auditEntries)
    .orderBy(desc(schema.auditEntries.id))
    .limit(1);
  return rows[0]?.hash ?? "0";
}

export interface AuditRow {
  timestamp: string;
  actor: string;
  action: string;
  detail: string; // exact serialized JSON string
  prevHash: string;
  hash: string;
}

/** Insert one audit row. `detail` MUST be the exact serialized JSON string. */
export async function insertAuditEntry(row: AuditRow): Promise<void> {
  await getDb().insert(schema.auditEntries).values(row);
}

/** All audit rows in insertion order (ORDER BY id ASC). */
export async function getAuditRows(): Promise<AuditRow[]> {
  const rows = await getDb()
    .select({
      timestamp: schema.auditEntries.timestamp,
      actor: schema.auditEntries.actor,
      action: schema.auditEntries.action,
      detail: schema.auditEntries.detail,
      prevHash: schema.auditEntries.prevHash,
      hash: schema.auditEntries.hash,
    })
    .from(schema.auditEntries)
    .orderBy(schema.auditEntries.id);
  return rows as AuditRow[];
}

/**
 * Delete a user and ALL their FK-dependent data, in FK-safe order, inside a
 * single transaction:
 *   thread_messages (of the user's threads) → threads → the users row.
 * Audit entries are intentionally LEFT INTACT — the append-only audit chain
 * must not be mutated (deleting links would break verifyChain), and the
 * account-deletion event itself is logged by the caller.
 *
 * Returns true if a user row was deleted, false if no such user existed.
 */
export async function deleteUserCascade(userId: string): Promise<boolean> {
  return getDb().transaction(async (tx: Database) => {
    const threadRows = (await tx
      .select({ id: schema.threads.id })
      .from(schema.threads)
      .where(eq(schema.threads.userId, userId))) as Array<{ id: string }>;
    const threadIds = threadRows.map((r) => r.id);

    if (threadIds.length > 0) {
      await tx
        .delete(schema.threadMessages)
        .where(inArray(schema.threadMessages.threadId, threadIds));
      await tx.delete(schema.threads).where(eq(schema.threads.userId, userId));
    }

    const deleted = await tx
      .delete(schema.users)
      .where(eq(schema.users.id, userId))
      .returning({ id: schema.users.id });

    return deleted.length > 0;
  });
}
