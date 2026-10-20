"use server";

import { revalidatePath } from "next/cache";
import { auth, refreshSessionCookie } from "@/lib/auth";
import { completeOnboarding, type OnboardingResult } from "@/lib/onboarding";
import { getT } from "@/lib/i18n/server";

export async function saveOnboardingAction(input: unknown): Promise<OnboardingResult> {
  const session = await auth();
  const t = await getT();
  if (!session?.user?.id) return { ok: false, error: t.account.settings.errSignInAgain, status: 401 };

  const result = await completeOnboarding(session.user.id, input);
  if (!result.ok) {
    // Localize the known failure reasons (the lib returns English for API callers).
    const o = t.account.onboarding;
    const byStatus: Record<number, string> = { 400: o.errInvalid, 404: o.errUserNotFound, 403: o.errPremiumOnly };
    return { ...result, error: byStatus[result.status] ?? result.error };
  }
  if (result.ok) {
    await refreshSessionCookie();
    revalidatePath("/", "layout");
  }
  return result;
}
