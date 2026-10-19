import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { onboardingSchema } from "@/lib/validators";
import { readJSON, writeJSON } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { generateMaskedAddress } from "@/lib/mail";
import type { User } from "@/lib/types";

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

  const users = readJSON<User[]>("users.json");
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  users[idx].consent = parsed.data.consent;
  users[idx].onboarded = true;
  if (!users[idx].maskedInbox) {
    users[idx].maskedInbox = generateMaskedAddress(userId);
  }

  writeJSON("users.json", users);

  logEvent(userId, "user.onboarded", {
    consentFields: Object.keys(parsed.data.consent).filter(
      (k) => parsed.data.consent[k as keyof typeof parsed.data.consent]
    ),
  });

  return NextResponse.json({
    maskedInbox: users[idx].maskedInbox,
    onboarded: true,
  });
}
