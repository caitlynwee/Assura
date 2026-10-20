import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { emptyTrash, getDeletedConversationsByUser } from "@/lib/db";
import { purgeDate, purgeExpiredChats } from "@/lib/chat-trash";
import { TRASH_RETENTION_DAYS } from "@/lib/constants";

/** GET /api/chat/trash — the user's "Recently deleted" chats. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await purgeExpiredChats();
  const conversations = (await getDeletedConversationsByUser(session.user.id!)).map((c) => ({
    ...c,
    purgeAt: purgeDate(c.deletedAt!),
  }));
  return NextResponse.json({ conversations, retentionDays: TRASH_RETENTION_DAYS });
}

/** DELETE /api/chat/trash — "Empty bin": permanently delete every binned chat. */
export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id!;
  const count = await emptyTrash(userId);
  void logEvent(userId, "chat.trash_emptied", { count }).catch(() => {});
  return NextResponse.json({ ok: true, count });
}
