import { NextRequest, NextResponse } from "next/server";
import { appendThreadMessage, getDb } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq } from "drizzle-orm";
import { logEvent } from "@/lib/audit";
import type { ThreadMessage } from "@/lib/types";

const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-key";

interface ReplyPayload {
  threadId: string;
  message: ThreadMessage;
  riskFlag?: string;
}

export async function POST(req: NextRequest) {
  if (req.headers.get("x-internal-api-key") !== INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = (await req.json().catch(() => null)) as ReplyPayload | null;
  if (!payload?.threadId || !payload.message?.body || payload.message.direction !== "inbound") {
    return NextResponse.json({ error: "Invalid reply payload" }, { status: 400 });
  }

  const db = getDb();

  // Fetch thread to verify existence and get userId for audit log.
  const rows = await db
    .select()
    .from(schema.threads)
    .where(eq(schema.threads.id, payload.threadId))
    .limit(1);
  const thread = rows[0];
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const newStatus = payload.riskFlag ? "flagged" : "replied";

  await appendThreadMessage(payload.threadId, payload.message, newStatus, now);

  // Append the riskFlag if present (appendThreadMessage only updates status/updatedAt).
  if (payload.riskFlag) {
    const currentFlags = (thread.riskFlags as string[]) ?? [];
    if (!currentFlags.includes(payload.riskFlag)) {
      await db
        .update(schema.threads)
        .set({ riskFlags: [...currentFlags, payload.riskFlag] })
        .where(eq(schema.threads.id, payload.threadId));
    }
  }

  logEvent(thread.userId, "crm.reply.received", {
    threadId: thread.id,
    flagged: Boolean(payload.riskFlag),
  });

  return NextResponse.json({ status: "stored" });
}
