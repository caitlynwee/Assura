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
import { getInsurerRecipientAddress } from "@/lib/insurer-recipient";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userTier = (session.user as any).tier;

  const body = await req.json().catch(() => null);
  const parsed = sendRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    assertAllowed("send_email", {
      userId,
      userTier,
      userApproved: parsed.data.userApproved,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 403 },
    );
  }

  const { insurerId, subject, body: emailBody, threadId } = parsed.data;

  // Scan both editable fields before anything reaches the outreach server.
  try {
    blockIfNeeded(`${subject}\n${emailBody}`, userId);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message, code: "PII_BLOCKED" },
      { status: 422 },
    );
  }

  const insurer = await getInsurerById(insurerId);
  if (!insurer) {
    return NextResponse.json({ error: "Insurer not found" }, { status: 404 });
  }

  const user = await getUserById(userId);
  const fromAddress = user?.maskedInbox ?? generateMaskedAddress(userId);

  // Validate existing thread if provided.
  if (threadId) {
    const existingThread = await getThreadById(threadId, userId);
    if (!existingThread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }
    if (existingThread.insurerId !== insurerId) {
      return NextResponse.json(
        { error: "Insurer does not match thread" },
        { status: 400 },
      );
    }
  }

  let delivery: { messageId: string; from: string; to: string };
  try {
    delivery = await sendEmail({
      from: fromAddress,
      to: getInsurerRecipientAddress(insurer.id, insurer.agentEmail),
      subject,
      body: emailBody,
      userId,
      threadId,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Could not send through the outreach server: ${(err as Error).message}`,
      },
      { status: 502 },
    );
  }

  // Update or create thread in the DB.
  const now = new Date().toISOString();
  const newMessage: ThreadMessage = {
    id: generateId("msg"),
    direction: "outbound",
    from: delivery.from,
    to: delivery.to,
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

  return NextResponse.json({
    threadId: resolvedThreadId,
    messageId: delivery.messageId,
  });
}
