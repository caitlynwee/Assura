import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPolicyConversationsByDocument } from "@/lib/db";
import { purgeExpiredPolicyChats } from "@/lib/policy-chat-trash";

/** GET /api/policy-chat/conversations?documentId=... */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const documentId = req.nextUrl.searchParams.get("documentId");
  if (!documentId) {
    return NextResponse.json({ error: "documentId is required" }, { status: 400 });
  }
  await purgeExpiredPolicyChats();
  const conversations = await getPolicyConversationsByDocument(documentId, session.user.id!);
  return NextResponse.json({ conversations });
}
