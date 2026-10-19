import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertAllowed } from "@/lib/policy";
import { extractQuoteFromThread } from "@/lib/ai";
import { readJSON, writeJSON } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import type { Thread } from "@/lib/types";

export async function POST(
  _req: NextRequest,
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
    assertAllowed("extract_quote", { userId, userTier });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }

  const threads = readJSON<Thread[]>("threads.json");
  const idx = threads.findIndex(
    (t) => t.id === threadId && t.userId === userId
  );

  if (idx === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const thread = threads[idx];
  const quote = await extractQuoteFromThread(thread.messages);

  threads[idx].extractedQuote = {
    ...quote,
    extractedAt: new Date().toISOString(),
  };
  threads[idx].status = "info_received";
  threads[idx].updatedAt = new Date().toISOString();

  writeJSON("threads.json", threads);

  logEvent(userId, "quote.extracted", { threadId });

  return NextResponse.json({ quote: threads[idx].extractedQuote });
}
