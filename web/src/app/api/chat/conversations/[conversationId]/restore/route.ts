import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { restoreConversation } from "@/lib/db";

type Params = { params: Promise<{ conversationId: string }> };

/** POST — bring a conversation back from "Recently deleted" (owner only). */
export async function POST(_req: NextRequest, { params }: Params) {
  const { conversationId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id!;

  const ok = await restoreConversation(conversationId, userId);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  void logEvent(userId, "chat.conversation_restored", { conversationId }).catch(() => {});
  return NextResponse.json({ ok: true });
}
