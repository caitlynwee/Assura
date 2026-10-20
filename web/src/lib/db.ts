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

import { setDefaultResultOrder } from "node:dns";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { eq, and, desc, inArray, isNull, isNotNull, gte, lt } from "drizzle-orm";
import postgres from "postgres";

// Force IPv4 DNS — Docker on macOS resolves Supabase to IPv6 which is unreachable.
setDefaultResultOrder("ipv4first");
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
  UserProfile,
  ChatConversation,
  ChatMessage,
  Citation,
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
  // Keep total session-pool usage small: the scraper and migration job share
  // Supabase's limited session-mode connection pool with this web process.
  const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
  sqlClient = postgres(url, { max: 3, ssl: isLocal ? false : "require" });
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
    profile: (row.profile as UserProfile | null) ?? {},
    createdAt: row.createdAt,
    ...(row.authUid != null ? { authUid: row.authUid } : {}),
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
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

/** Sync the email from an already-verified Supabase identity to its app row. */
export async function syncUserEmailByAuthUid(
  authUid: string,
  email: string
): Promise<User | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await getUserByAuthUid(authUid);
  if (!user) return null;

  const existingEmailOwner = await getUserByEmail(normalizedEmail);
  if (existingEmailOwner && existingEmailOwner.id !== user.id) return null;
  if (user.email === normalizedEmail) return user;

  const rows = await getDb()
    .update(schema.users)
    .set({ email: normalizedEmail })
    .where(eq(schema.users.authUid, authUid))
    .returning();
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

export async function getPlans(country?: string): Promise<Plan[]> {
  const db = getDb();
  const rows = country
    ? await db.select().from(schema.plans).where(eq(schema.plans.country, country))
    : await db.select().from(schema.plans);
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

// ─── chat conversations (Plan Q&A history) ───────────────────────────────────
// Every query is scoped by userId so one user can never read, change or delete
// another user's conversations.
//
// Lifecycle: active (deletedAt null) → "Recently deleted" (deletedAt set) →
// permanently removed after TRASH_RETENTION_DAYS, or immediately via
// "Delete forever" / "Empty bin". Messages cascade with their conversation.

type ConversationRow = typeof schema.chatConversations.$inferSelect;
type ChatMessageRow = typeof schema.chatMessages.$inferSelect;

function rowToConversation(row: ConversationRow): ChatConversation {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
  };
}

function rowToChatMessage(row: ChatMessageRow): ChatMessage {
  const citations = row.citations as Citation[] | null;
  return {
    id: row.id,
    role: row.role as ChatMessage["role"],
    content: row.content,
    timestamp: row.timestamp,
    ...(citations && citations.length > 0 ? { citations } : {}),
  };
}

const ownedBy = (conversationId: string, userId: string) =>
  and(
    eq(schema.chatConversations.id, conversationId),
    eq(schema.chatConversations.userId, userId)
  );

/** A user's active conversations, most recently active first. */
export async function getConversationsByUser(
  userId: string
): Promise<ChatConversation[]> {
  const rows = (await getDb()
    .select()
    .from(schema.chatConversations)
    .where(
      and(
        eq(schema.chatConversations.userId, userId),
        isNull(schema.chatConversations.deletedAt)
      )
    )
    .orderBy(desc(schema.chatConversations.updatedAt))) as ConversationRow[];
  return rows.map(rowToConversation);
}

/** A user's "Recently deleted" conversations, most recently deleted first. */
export async function getDeletedConversationsByUser(
  userId: string
): Promise<ChatConversation[]> {
  const rows = (await getDb()
    .select()
    .from(schema.chatConversations)
    .where(
      and(
        eq(schema.chatConversations.userId, userId),
        isNotNull(schema.chatConversations.deletedAt)
      )
    )
    .orderBy(desc(schema.chatConversations.deletedAt))) as ConversationRow[];
  return rows.map(rowToConversation);
}

/**
 * One ACTIVE conversation, only if it belongs to `userId`.
 * Conversations in "Recently deleted" are treated as not found.
 */
export async function getConversationById(
  conversationId: string,
  userId: string
): Promise<ChatConversation | null> {
  const rows = (await getDb()
    .select()
    .from(schema.chatConversations)
    .where(
      and(
        ownedBy(conversationId, userId),
        isNull(schema.chatConversations.deletedAt)
      )
    )
    .limit(1)) as ConversationRow[];
  return rows[0] ? rowToConversation(rows[0]) : null;
}

/** Messages of a conversation in order. Caller must check ownership first. */
export async function getConversationMessages(
  conversationId: string
): Promise<ChatMessage[]> {
  const rows = (await getDb()
    .select()
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.conversationId, conversationId))
    .orderBy(schema.chatMessages.ordering)) as ChatMessageRow[];
  return rows.map(rowToChatMessage);
}

export async function insertConversation(
  conversation: Omit<ChatConversation, "deletedAt"> & { userId: string }
): Promise<void> {
  await getDb().insert(schema.chatConversations).values({
    id: conversation.id,
    userId: conversation.userId,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    deletedAt: null,
  });
}

/** Append a message and bump the conversation's updatedAt. */
export async function appendConversationMessage(
  conversationId: string,
  messageId: string,
  message: ChatMessage
): Promise<void> {
  const db = getDb();
  const existing = await db
    .select({ id: schema.chatMessages.id })
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.conversationId, conversationId));
  await db.insert(schema.chatMessages).values({
    id: messageId,
    conversationId,
    ordering: existing.length,
    role: message.role,
    content: message.content,
    citations: message.citations ?? null,
    timestamp: message.timestamp,
  });
  await db
    .update(schema.chatConversations)
    .set({ updatedAt: message.timestamp })
    .where(eq(schema.chatConversations.id, conversationId));
}

/**
 * Edit support: remove a USER message and everything after it, so the edited
 * text can be appended in its place and the answer regenerated.
 * Returns false (and changes nothing) if the message isn't a user message in
 * this conversation. Caller must check conversation ownership first.
 */
export async function truncateConversationFrom(
  conversationId: string,
  messageId: string
): Promise<boolean> {
  const db = getDb();
  const rows = (await db
    .select()
    .from(schema.chatMessages)
    .where(
      and(
        eq(schema.chatMessages.id, messageId),
        eq(schema.chatMessages.conversationId, conversationId)
      )
    )
    .limit(1)) as ChatMessageRow[];
  const target = rows[0];
  if (!target || target.role !== "user") return false;

  await db
    .delete(schema.chatMessages)
    .where(
      and(
        eq(schema.chatMessages.conversationId, conversationId),
        gte(schema.chatMessages.ordering, target.ordering)
      )
    );
  return true;
}

/** Move a conversation to "Recently deleted". False if not owned/active. */
export async function softDeleteConversation(
  conversationId: string,
  userId: string,
  deletedAt: string
): Promise<boolean> {
  const updated = await getDb()
    .update(schema.chatConversations)
    .set({ deletedAt })
    .where(
      and(
        ownedBy(conversationId, userId),
        isNull(schema.chatConversations.deletedAt)
      )
    )
    .returning({ id: schema.chatConversations.id });
  return updated.length > 0;
}

/** Bring a conversation back from "Recently deleted". False if not in the bin. */
export async function restoreConversation(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const updated = await getDb()
    .update(schema.chatConversations)
    .set({ deletedAt: null })
    .where(
      and(
        ownedBy(conversationId, userId),
        isNotNull(schema.chatConversations.deletedAt)
      )
    )
    .returning({ id: schema.chatConversations.id });
  return updated.length > 0;
}

/**
 * Permanently delete a conversation (messages cascade), whether active or in
 * the bin. Returns false if not owned/found.
 */
export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const deleted = await getDb()
    .delete(schema.chatConversations)
    .where(ownedBy(conversationId, userId))
    .returning({ id: schema.chatConversations.id });
  return deleted.length > 0;
}

/** "Empty bin": permanently delete all of a user's binned conversations. */
export async function emptyTrash(userId: string): Promise<number> {
  const deleted = await getDb()
    .delete(schema.chatConversations)
    .where(
      and(
        eq(schema.chatConversations.userId, userId),
        isNotNull(schema.chatConversations.deletedAt)
      )
    )
    .returning({ id: schema.chatConversations.id });
  return deleted.length;
}

/**
 * Permanently delete every binned conversation (all users) that was deleted
 * before `cutoffIso`. ISO-8601 UTC strings compare correctly as text.
 */
export async function purgeExpiredConversations(cutoffIso: string): Promise<number> {
  const deleted = await getDb()
    .delete(schema.chatConversations)
    .where(
      and(
        isNotNull(schema.chatConversations.deletedAt),
        lt(schema.chatConversations.deletedAt, cutoffIso)
      )
    )
    .returning({ id: schema.chatConversations.id });
  return deleted.length;
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
