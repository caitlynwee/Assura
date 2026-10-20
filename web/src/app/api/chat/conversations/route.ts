import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getConversationsByUser } from "@/lib/db";

/** GET /api/chat/conversations — the signed-in user's chat history list. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const conversations = await getConversationsByUser(session.user.id!);
  return NextResponse.json({ conversations });
}
