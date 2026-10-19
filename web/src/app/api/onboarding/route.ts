import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { onboardingSchema } from "@/lib/validators";
import { getUserById, updateUserOnboarding } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { generateMaskedAddress } from "@/lib/mail";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id!;

  const body = await req.json();
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const existing = await getUserById(userId);
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const maskedInbox = existing.maskedInbox || generateMaskedAddress(userId);

  const updated = await updateUserOnboarding(
    userId,
    parsed.data.consent,
    maskedInbox
  );
  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await logEvent(userId, "user.onboarded", {
    consentFields: Object.keys(parsed.data.consent).filter(
      (k) => parsed.data.consent[k as keyof typeof parsed.data.consent]
    ),
  });

  return NextResponse.json({
    maskedInbox: updated.maskedInbox,
    onboarded: true,
  });
}
