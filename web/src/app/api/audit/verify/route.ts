import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { verifyChain } from "@/lib/audit";
import { logEvent } from "@/lib/audit";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await verifyChain();

  await logEvent(session.user.id!, "audit.verify", {
    valid: result.valid,
    entries: result.entries,
    brokenAt: result.brokenAt ?? null,
  });

  return NextResponse.json(result);
}
