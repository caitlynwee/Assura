import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readJSON } from "@/lib/db";
import type { Thread } from "@/lib/types";

const SCRAPER_URL = process.env.SCRAPER_URL ?? "http://localhost:8100";
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-key";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const thread = readJSON<Thread[]>("threads.json").find(
    (candidate) => candidate.id === threadId && candidate.userId === session.user!.id
  );
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  try {
    const response = await fetch(`${SCRAPER_URL}/email/reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": INTERNAL_API_SECRET,
      },
      body: JSON.stringify({ thread_id: thread.id, insurer_id: thread.insurerId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail ?? "Outreach server could not simulate a reply." },
        { status: response.status === 403 ? 502 : response.status }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: `Outreach server unavailable: ${String(error)}` },
      { status: 503 }
    );
  }
}
