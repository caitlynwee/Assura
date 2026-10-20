import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { scraperTriggerSchema } from "@/lib/validators";
import { assertAllowed } from "@/lib/policy";
import { logEvent } from "@/lib/audit";

const SCRAPER_URL = process.env.SCRAPER_URL ?? "http://localhost:8100";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userTier = (session.user as any).tier;

  try {
    assertAllowed("trigger_scraper", { userId, userTier, userApproved: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = scraperTriggerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await logEvent(userId, "scraper.triggered", {
    sourceId: parsed.data.sourceId ?? "all",
  });

  try {
    const res = await fetch(`${SCRAPER_URL}/scraper/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_id: parsed.data.sourceId }),
    });
    if (!res.ok) throw new Error("Scraper returned " + res.status);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Scraper server unavailable", detail: String(err) },
      { status: 503 }
    );
  }
}
