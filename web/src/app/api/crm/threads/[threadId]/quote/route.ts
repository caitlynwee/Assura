import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertAllowed } from "@/lib/policy";
import { extractQuoteFromThread } from "@/lib/ai";
import { getThreadById, updateThread } from "@/lib/db";
import { logEvent } from "@/lib/audit";

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

  const thread = await getThreadById(threadId, userId);
  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const quote = await extractQuoteFromThread(thread.messages);

  const extractedQuote = {
    ...quote,
    extractedAt: new Date().toISOString(),
  };
  const updatedAt = new Date().toISOString();
  await updateThread(threadId, {
    extractedQuote,
    status: "info_received",
    updatedAt,
  });

  await logEvent(userId, "quote.extracted", { threadId });

  return NextResponse.json({ quote: extractedQuote });
}
