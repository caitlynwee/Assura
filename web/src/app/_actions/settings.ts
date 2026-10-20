"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth, refreshSessionCookie } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { findUserById, updateUser } from "@/lib/users";
import { profileSchema } from "@/lib/validators";
import { getServerClient } from "@/lib/supabase/server";
import { DEMO_EMAIL } from "@/lib/demo";
import { maskEmail } from "@/lib/utils";
import { openBillingPortalAction } from "@/app/_actions/billing";

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  profile: profileSchema,
});

export type SettingsResult =
  | { ok: true }
  | { ok: false; error: string };

export type EmailChangeResult =
  | { ok: true; pendingEmail: string }
  | { ok: false; error: string };

const emailChangeSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

export async function requestEmailChangeAction(
  input: unknown
): Promise<EmailChangeResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in again." };
  if (session.user.email.toLowerCase() === DEMO_EMAIL) {
    return { ok: false, error: "The shared demo account email cannot be changed." };
  }

  const parsed = emailChangeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (parsed.data.email === session.user.email.toLowerCase()) {
    return { ok: false, error: "Enter a different email address." };
  }

  const supabase = await getServerClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  const emailRedirectTo = new URL("/auth/callback", siteUrl).toString();
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo }
  );
  if (error) {
    if (error.code === "email_exists" || error.code === "user_already_exists") {
      return { ok: false, error: "An account already uses that email address." };
    }
    console.error("[settings] Supabase email change request failed:", error.message);
    return { ok: false, error: "We couldn't start the email change. Please try again." };
  }

  await logEvent(session.user.id, "auth.email_change_requested", {
    email: maskEmail(parsed.data.email),
  });
  return { ok: true, pendingEmail: parsed.data.email };
}

export async function saveSettingsAction(input: unknown): Promise<SettingsResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in again." };

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Some fields are invalid. Please check your information." };
  }

  const updated = await updateUser(session.user.id, (user) => {
    user.name = parsed.data.name;
    user.profile = parsed.data.profile;
  });
  if (!updated) return { ok: false, error: "Your account could not be found." };

  await logEvent(session.user.id, "user.profile_updated", {
    fields: Object.keys(parsed.data.profile),
    nameChanged: updated.name !== session.user.name,
  });
  revalidatePath("/", "layout");
  revalidatePath("/settings");
  return { ok: true };
}

export async function downgradeToFreeAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");
  if (session.user.email.toLowerCase() === DEMO_EMAIL) {
    return redirect("/settings?toast=downgrade-demo-blocked");
  }
  if (session.user.tier === "free") {
    return redirect("/settings?toast=already-free");
  }

  const currentUser = await findUserById(session.user.id);
  if (!currentUser) return redirect("/settings?toast=downgrade-failed");
  if (currentUser.stripeCustomerId || currentUser.stripeSubscriptionId) {
    return openBillingPortalAction();
  }

  const updated = await updateUser(session.user.id, (user) => {
    user.tier = "free";
  });
  if (!updated) return redirect("/login");

  await logEvent(session.user.id, "user.tier_changed", {
    from: session.user.tier,
    to: "free",
  });
  await refreshSessionCookie();
  revalidatePath("/", "layout");
  redirect("/compare?toast=downgraded");
}
