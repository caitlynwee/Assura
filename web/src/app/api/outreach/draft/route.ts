import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { draftRequestSchema } from "@/lib/validators";
import { assertAllowed } from "@/lib/policy";
import { draftOutreachEmail } from "@/lib/ai";
import { readJSON } from "@/lib/db";
import { OUTREACH_TEMPLATES } from "@/lib/constants";
import type { Insurer, User } from "@/lib/types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userTier = (session.user as any).tier;

  try {
    assertAllowed("draft_email", { userId: session.user.id!, userTier });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }

  const body = await req.json();
  const parsed = draftRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { insurerId, templateId, userContext } = parsed.data;

  const insurers = readJSON<Insurer[]>("insurers.json");
  const insurer = insurers.find((i) => i.id === insurerId);
  if (!insurer) {
    return NextResponse.json({ error: "Insurer not found" }, { status: 404 });
  }

  const template = OUTREACH_TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const users = readJSON<User[]>("users.json");
  const user = users.find((u) => u.id === session.user!.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const draft = await draftOutreachEmail({
    insurerName: insurer.name,
    templatePromptHint: template.promptHint,
    consent: user.consent,
    userContext,
  });

  return NextResponse.json({ draft, insurer: { id: insurer.id, name: insurer.name } });
}
