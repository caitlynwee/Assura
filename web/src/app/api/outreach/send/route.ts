import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendRequestSchema } from "@/lib/validators";
import { assertAllowed } from "@/lib/policy";
import { blockIfNeeded } from "@/lib/blocker";
import { sendEmail, generateMaskedAddress } from "@/lib/mail";
import {
  getInsurerById,
  getUserById,
  getThreadById,
  insertThread,
  appendThreadMessage,
} from "@/lib/db";
import { generateId } from "@/lib/utils";
import type { Thread, ThreadMessage } from "@/lib/types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userTier = (session.user as any).tier;

  try {
    assertAllowed("send_email", { userId, userTier, userApproved: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }

  const body = await req.json();
  const parsed = sendRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { insurerId, subject, body: emailBody, threadId } = parsed.data;

  // PII blocker — blocks if NRIC, phone, health keywords detected
  try {
    blockIfNeeded(emailBody, userId);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message, code: "PII_BLOCKED" },
      { status: 422 }
    );
  }

  const insurer = await getInsurerById(insurerId);
  if (!insurer) {
    return NextResponse.json({ error: "Insurer not found" }, { status: 404 });
  }

  const user = await getUserById(userId);
  const fromAddress = user?.maskedInbox ?? generateMaskedAddress(userId);

  const messageId = await sendEmail({
    from: fromAddress,
    to: insurer.agentEmail,
    subject,
    body: emailBody,
    userId,
    threadId,
  });

  // Update or create thread
  const now = new Date().toISOString();
  const newMessage: ThreadMessage = {
    id: generateId("msg"),
    direction: "outbound",
    from: fromAddress,
    to: insurer.agentEmail,
    subject,
    body: emailBody,
    timestamp: now,
    aiGenerated: true,
    flagged: false,
  };

  let resolvedThreadId: string | null = null;

  if (threadId) {
    const existing = await getThreadById(threadId, userId);
    if (existing) {
      await appendThreadMessage(threadId, newMessage, "sent", now);
      resolvedThreadId = threadId;
    }
  }

  if (!resolvedThreadId) {
    const thread: Thread = {
      id: generateId("thread"),
      userId,
      insurerId,
      insurerName: insurer.name,
      subject,
      status: "sent",
      messages: [newMessage],
      extractedQuote: null,
      riskFlags: [],
      addedToComparison: false,
      createdAt: now,
      updatedAt: now,
    };
    await insertThread(thread);
    resolvedThreadId = thread.id;
  }

  return NextResponse.json({ threadId: resolvedThreadId, messageId });
}
