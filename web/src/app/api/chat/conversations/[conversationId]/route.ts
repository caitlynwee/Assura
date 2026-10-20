import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import {
  getConversationById,
  getConversationMessages,
  deleteConversation,
} from "@/lib/db";

type Params = { params: Promise<{ conversationId: string }> };

/** GET — one conversation with its messages (owner only). */
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

/** DELETE — permanently remove a conversation and its messages (owner only). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { conversationId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id!;

  const deleted = await deleteConversation(conversationId, userId);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Audit the deletion (id only — never the chat content).
  void logEvent(userId, "chat.conversation_deleted", { conversationId }).catch(() => {});
  return NextResponse.json({ ok: true });
}
