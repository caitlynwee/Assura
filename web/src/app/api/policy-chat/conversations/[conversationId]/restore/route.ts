import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { restorePolicyConversation } from "@/lib/db";

type Params = { params: Promise<{ conversationId: string }> };

/** POST — restore a policy-chat conversation from "Recently deleted". */
export async function POST(_req: NextRequest, { params }: Params) {
  const { conversationId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id!;
  const ok = await restorePolicyConversation(conversationId, userId);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  void logEvent(userId, "policy_chat.conversation_restored", { conversationId }).catch(() => {});
  return NextResponse.json({ ok: true });
}
