import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { evaluateAction } from "@/lib/policy";
import { getThreadsByUser } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userTier = (session.user as any).tier;

  const decision = evaluateAction("read_threads", { userId, userTier });
  if (decision.outcome !== "allow") {
    return NextResponse.json({ error: decision.reason }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status");
  let threads = await getThreadsByUser(userId);

  if (status) {
    threads = threads.filter((t) => t.status === status);
  }

  // Sort newest first
  threads.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return NextResponse.json({ threads });
}
