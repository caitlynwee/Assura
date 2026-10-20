import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPolicyDocumentFile } from "@/lib/db";

type Params = { params: Promise<{ documentId: string }> };

/** GET /api/policy-chat/documents/[documentId]/download — stream the original PDF. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { documentId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const file = await getPolicyDocumentFile(documentId, session.user.id!);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new Response(file.data as unknown as BodyInit, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.filename)}"`,
      "Content-Length": String(file.data.length),
    },
  });
}
