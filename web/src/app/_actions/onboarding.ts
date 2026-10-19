"use server";

import { revalidatePath } from "next/cache";
import { auth, refreshSessionCookie } from "@/lib/auth";
import { completeOnboarding, type OnboardingResult } from "@/lib/onboarding";

export async function saveOnboardingAction(input: unknown): Promise<OnboardingResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in again.", status: 401 };

  const result = completeOnboarding(session.user.id, input);
  if (result.ok) {
    await refreshSessionCookie();
    revalidatePath("/", "layout");
  }
  return result;
}
