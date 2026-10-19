import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { threadUpdateSchema } from "@/lib/validators";
import { assertAllowed } from "@/lib/policy";
import { readJSON, writeJSON } from "@/lib/db";
import type { Thread } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threads = readJSON<Thread[]>("threads.json");
  const thread = threads.find(
    (t) => t.id === threadId && t.userId === session.user!.id
  );

  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ thread });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userTier = (session.user as any).tier;

  try {
    assertAllowed("update_thread_status", { userId, userTier });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }

  const body = await req.json();
  const parsed = threadUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  }

  const threads = readJSON<Thread[]>("threads.json");
  const idx = threads.findIndex(
    (t) => t.id === threadId && t.userId === userId
  );

  if (idx === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { status, addedToComparison } = parsed.data;
  if (status) threads[idx].status = status;
  if (addedToComparison !== undefined) threads[idx].addedToComparison = addedToComparison;
  threads[idx].updatedAt = new Date().toISOString();

  writeJSON("threads.json", threads);

  return NextResponse.json({ thread: threads[idx] });
}
