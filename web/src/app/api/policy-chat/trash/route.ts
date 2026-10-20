import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { emptyPolicyTrash, getDeletedPolicyConversationsByUser } from "@/lib/db";
import { policyPurgeDate, purgeExpiredPolicyChats } from "@/lib/policy-chat-trash";
import { TRASH_RETENTION_DAYS } from "@/lib/constants";

/** GET /api/policy-chat/trash — "Recently deleted" policy-chat conversations. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await purgeExpiredPolicyChats();
  const conversations = (await getDeletedPolicyConversationsByUser(session.user.id!)).map((c) => ({
    ...c,
    purgeAt: policyPurgeDate(c.deletedAt!),
  }));
  return NextResponse.json({ conversations, retentionDays: TRASH_RETENTION_DAYS });
}

/** DELETE /api/policy-chat/trash — empty the bin. */
export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id!;
  const count = await emptyPolicyTrash(userId);
  void logEvent(userId, "policy_chat.trash_emptied", { count }).catch(() => {});
  return NextResponse.json({ ok: true, count });
}
