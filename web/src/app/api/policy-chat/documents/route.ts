import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import {
  insertPolicyDocument,
  getPolicyDocumentsByUser,
  updatePolicyDocumentText,
} from "@/lib/db";
import { extractPdfText } from "@/lib/pdf-extract";
import { logEvent } from "@/lib/audit";
import { MAX_POLICY_DOCUMENT_BYTES } from "@/lib/constants";

/** GET /api/policy-chat/documents — list the user's uploaded documents. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const documents = await getPolicyDocumentsByUser(session.user.id!);
  return NextResponse.json({ documents });
}

/** POST /api/policy-chat/documents — upload a PDF and start extraction. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id!;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
  }
  if (file.size > MAX_POLICY_DOCUMENT_BYTES) {
    return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const id = randomUUID();
  const now = new Date().toISOString();
  const title = file.name.replace(/\.pdf$/i, "").trim() || "Untitled policy";

  await insertPolicyDocument({
    id,
    userId,
    filename: file.name,
    contentType: file.type,
    size: file.size,
    data: buffer,
    title,
    uploadedAt: now,
  });

  // Extract text asynchronously — don't block the upload response.
  void (async () => {
    try {
      const { text, pageCount } = await extractPdfText(buffer);
      await updatePolicyDocumentText(id, text, pageCount);
    } catch {
      // Leave extractedText null; the chat will warn about limited answers.
    }
  })();

  void logEvent(userId, "policy_chat.document_uploaded", {
    documentId: id,
    filename: file.name,
    size: file.size,
  }).catch(() => {});

  const document = {
    id,
    filename: file.name,
    contentType: file.type,
    size: file.size,
    title,
    extractedText: null,
    pageCount: null,
    uploadedAt: now,
  };

  return NextResponse.json({ document }, { status: 201 });
}
