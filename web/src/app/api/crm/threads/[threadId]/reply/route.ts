import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getThreadById } from "@/lib/db";

const MAIL_SERVICE_URL = process.env.MAIL_SERVICE_URL ?? "http://localhost:8200";
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

  const thread = await getThreadById(threadId, session.user.id!);
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  try {
    const response = await fetch(`${MAIL_SERVICE_URL}/email/reply`, {
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
        { error: data.detail ?? "Mail service could not simulate a reply." },
        { status: response.status === 403 ? 502 : response.status }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: `Mail service unavailable: ${String(error)}` },
      { status: 503 }
    );
  }
}
