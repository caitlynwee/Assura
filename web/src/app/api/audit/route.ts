import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { evaluateAction } from "@/lib/policy";
import { getAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userTier = (session.user as any).tier;

  const decision = evaluateAction("read_audit", { userId, userTier });
  if (decision.outcome !== "allow") {
    return NextResponse.json({ error: decision.reason }, { status: 403 });
  }

  const page = parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10);
  const limit = 50;

  const all = await getAuditLog();
  const total = all.length;
  const entries = all
    .slice()
    .reverse()
    .slice((page - 1) * limit, page * limit);

  return NextResponse.json({ entries, total, page, limit });
}
