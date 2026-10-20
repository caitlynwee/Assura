import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertAllowed } from "@/lib/policy";
import { insertBrochure } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { generateId } from "@/lib/utils";

/**
 * POST /api/admin/plans/brochure — upload a plan brochure file.
 *
 * Multipart form-data with a single `file` field. Admin-only. The file is
 * stored in the database (see plan_brochures) and a stable download URL is
 * returned, which the admin "add plan" form puts into the plan's source URL so
 * the comparison table links straight to the uploaded brochure.
 *
 * This endpoint only STORES a file; it does not create a plan on its own.
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Brochures are typically PDFs; allow common image scans too.
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const EXT_BY_TYPE: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const userTier = session.user.tier;

  try {
    if (userTier !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    assertAllowed("create_plan", { userId, userTier, userApproved: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a PDF, PNG, JPG, or WebP." },
      { status: 415 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "The file is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large. The limit is 10 MB." },
      { status: 413 }
    );
  }

  const data = Buffer.from(await file.arrayBuffer());
  // Double-check the real byte length against the declared size.
  if (data.length > MAX_BYTES) {
    return NextResponse.json({ error: "File too large. The limit is 10 MB." }, { status: 413 });
  }

  const id = generateId("brochure");
  const ext = EXT_BY_TYPE[file.type] ?? "";
  // Keep a sanitized display name; the download route sets the real filename.
  const safeName = (file.name || `brochure${ext}`).replace(/[^\w.\-]+/g, "_").slice(0, 160);
  const now = new Date().toISOString();

  await insertBrochure({
    id,
    filename: safeName,
    contentType: file.type,
    size: data.length,
    data,
    uploadedBy: userId,
    uploadedAt: now,
  });

  await logEvent(userId, "plan.brochure_uploaded", {
    brochureId: id,
    filename: safeName,
    contentType: file.type,
    size: data.length,
  });

  // Relative URL the plan's sourceUrl points at; served by the download route.
  const url = `/api/plans/brochure/${id}`;
  return NextResponse.json({ ok: true, brochureId: id, url, filename: safeName }, { status: 201 });
}
