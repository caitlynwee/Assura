import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import {
  getPolicyConversationById,
  getPolicyConversationMessages,
  softDeletePolicyConversation,
  deletePolicyConversation,
} from "@/lib/db";

type Params = { params: Promise<{ conversationId: string }> };

/** GET — one active conversation with its messages (owner only). */
export async function GET(_req: NextRequest, { params }: Params) {
  const { conversationId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const conversation = await getPolicyConversationById(conversationId, session.user.id!);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const messages = await getPolicyConversationMessages(conversationId);
  return NextResponse.json({ conversation, messages });
}

/**
 * DELETE — soft-delete by default; `?permanent=true` deletes forever.
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
    ? await deletePolicyConversation(conversationId, userId)
    : await softDeletePolicyConversation(conversationId, userId, new Date().toISOString());
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  void logEvent(
    userId,
    permanent ? "policy_chat.conversation_purged" : "policy_chat.conversation_deleted",
    { conversationId }
  ).catch(() => {});
  return NextResponse.json({ ok: true });
}
