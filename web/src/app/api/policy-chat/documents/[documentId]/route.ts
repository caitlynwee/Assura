import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getPolicyDocumentById,
  updatePolicyDocumentTitle,
  deletePolicyDocument,
} from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { z } from "zod";

type Params = { params: Promise<{ documentId: string }> };

/** GET /api/policy-chat/documents/[documentId] — document metadata (no bytes). */
export async function GET(_req: NextRequest, { params }: Params) {
  const { documentId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const doc = await getPolicyDocumentById(documentId, session.user.id!);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ document: doc });
}

/** PATCH /api/policy-chat/documents/[documentId] — rename title. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { documentId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = z.object({ title: z.string().trim().min(1).max(200) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const ok = await updatePolicyDocumentTitle(documentId, session.user.id!, parsed.data.title);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/policy-chat/documents/[documentId] — delete document + cascade. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { documentId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id!;
  const ok = await deletePolicyDocument(documentId, userId);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  void logEvent(userId, "policy_chat.document_deleted", { documentId }).catch(() => {});
  return NextResponse.json({ ok: true });
}
