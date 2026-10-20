import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBrochureById } from "@/lib/db";

/**
 * GET /api/plans/brochure/[id] — download a brochure an admin uploaded for a
 * manually added plan. Auth-gated like the rest of the plan data: any signed-in
 * user can view it (it's the public brochure source for a comparison plan), but
 * anonymous requests get a 401. The bytes are streamed from the database.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const brochure = await getBrochureById(id);
  if (!brochure) {
    return NextResponse.json({ error: "Brochure not found" }, { status: 404 });
  }

  // Inline so PDFs/images open in the browser tab; the filename is used if the
  // user chooses "Save as".
  const asciiName = brochure.filename.replace(/[^\w.\-]+/g, "_");
  return new NextResponse(new Uint8Array(brochure.data), {
    status: 200,
    headers: {
      "Content-Type": brochure.contentType,
      "Content-Length": String(brochure.size),
      "Content-Disposition": `inline; filename="${asciiName}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
