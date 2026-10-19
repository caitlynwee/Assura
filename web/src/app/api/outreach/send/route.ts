import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendRequestSchema } from "@/lib/validators";
import { assertAllowed } from "@/lib/policy";
import { blockIfNeeded } from "@/lib/blocker";
import { sendEmail, generateMaskedAddress } from "@/lib/mail";
import { readJSON, writeJSON } from "@/lib/db";
import { generateId } from "@/lib/utils";
import type { Insurer, Thread, ThreadMessage, User } from "@/lib/types";

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
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }

  const { insurerId, subject, body: emailBody, threadId } = parsed.data;

  // Scan both editable fields before anything reaches the outreach server.
  try {
    blockIfNeeded(`${subject}\n${emailBody}`, userId);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message, code: "PII_BLOCKED" },
      { status: 422 }
    );
  }

  const insurers = readJSON<Insurer[]>("insurers.json");
  const insurer = insurers.find((i) => i.id === insurerId);
  if (!insurer) {
    return NextResponse.json({ error: "Insurer not found" }, { status: 404 });
  }

  const users = readJSON<User[]>("users.json");
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const fromAddress = user?.maskedInbox ?? generateMaskedAddress(userId);

  const threads = readJSON<Thread[]>("threads.json");
  if (threadId) {
    const existingThread = threads.find(
      (t) => t.id === threadId && t.userId === userId
    );
    if (!existingThread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }
    if (existingThread.insurerId !== insurerId) {
      return NextResponse.json({ error: "Insurer does not match thread" }, { status: 400 });
    }
  }

  let messageId: string;
  try {
    messageId = await sendEmail({
      from: fromAddress,
      to: insurer.agentEmail,
      subject,
      body: emailBody,
      userId,
      threadId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not send through the outreach server: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  // Update or create thread
  let thread: Thread | undefined;

  const newMessage: ThreadMessage = {
    id: generateId("msg"),
    direction: "outbound",
    from: fromAddress,
    to: insurer.agentEmail,
    subject,
    body: emailBody,
    timestamp: new Date().toISOString(),
    aiGenerated: true,
    flagged: false,
  };

  if (threadId) {
    thread = threads.find((t) => t.id === threadId && t.userId === userId);
    if (thread) {
      thread.messages.push(newMessage);
      thread.status = "sent";
      thread.updatedAt = new Date().toISOString();
    }
  } else {
    thread = {
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    threads.push(thread);
  }

  writeJSON("threads.json", threads);

  return NextResponse.json({ threadId: thread!.id, messageId });
}
