import { NextRequest, NextResponse } from "next/server";
import { readJSON, writeJSON } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import type { Thread, ThreadMessage } from "@/lib/types";

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

  const threads = readJSON<Thread[]>("threads.json");
  const index = threads.findIndex((thread) => thread.id === payload.threadId);
  if (index === -1) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const thread = threads[index];
  thread.messages.push(payload.message);
  thread.status = payload.riskFlag ? "flagged" : "replied";
  if (payload.riskFlag && !thread.riskFlags.includes(payload.riskFlag)) {
    thread.riskFlags.push(payload.riskFlag);
  }
  thread.updatedAt = new Date().toISOString();
  writeJSON("threads.json", threads);
  logEvent(thread.userId, "crm.reply.received", {
    threadId: thread.id,
    flagged: Boolean(payload.riskFlag),
  });

  return NextResponse.json({ status: "stored" });
}
