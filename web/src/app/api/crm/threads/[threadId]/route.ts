import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { threadUpdateSchema } from "@/lib/validators";
import { assertAllowed } from "@/lib/policy";
import { getThreadById, updateThread } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const thread = await getThreadById(threadId, session.user!.id!);

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

  const existing = await getThreadById(threadId, userId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { status, addedToComparison } = parsed.data;
  const updatedAt = new Date().toISOString();
  await updateThread(threadId, {
    ...(status ? { status } : {}),
    ...(addedToComparison !== undefined ? { addedToComparison } : {}),
    updatedAt,
  });

  const updated = await getThreadById(threadId, userId);
  return NextResponse.json({ thread: updated });
}
