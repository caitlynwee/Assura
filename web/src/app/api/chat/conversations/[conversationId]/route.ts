import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import {
  getConversationById,
  getConversationMessages,
  softDeleteConversation,
  deleteConversation,
} from "@/lib/db";

type Params = { params: Promise<{ conversationId: string }> };

/** GET — one active conversation with its messages (owner only). */
export async function GET(_req: NextRequest, { params }: Params) {
  const { conversationId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversation = await getConversationById(conversationId, session.user.id!);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const messages = await getConversationMessages(conversationId);
  return NextResponse.json({ conversation, messages });
}

/**
 * DELETE — move a conversation to "Recently deleted" (default), or with
 * `?permanent=true` delete it forever (from the bin or directly). Owner only.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { conversationId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id!;
  const permanent = req.nextUrl.searchParams.get("permanent") === "true";

  const ok = permanent
    ? await deleteConversation(conversationId, userId)
    : await softDeleteConversation(conversationId, userId, new Date().toISOString());
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Audit ids only — never chat content.
  void logEvent(
    userId,
    permanent ? "chat.conversation_purged" : "chat.conversation_deleted",
    { conversationId }
  ).catch(() => {});
  return NextResponse.json({ ok: true });
}
