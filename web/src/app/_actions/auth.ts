"use server";

/**
 * Auth server actions. Using Server Actions (rather than a client signIn) means
 * forms work without client JS and the password never passes through client-
 * side code beyond the form post. Supabase Auth verifies credentials and issues
 * the session; the app `users` row stays the source of truth (linked by
 * auth_uid). Audit events are logged here (success/failure/lock), with
 * maskEmail() so raw emails never reach the audit chain.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth, refreshSessionCookie, signOut } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { deleteUserCascade } from "@/lib/db";
import { syncAuthMetadata } from "@/lib/supabase/ensure-demo-user";
import { loginSchema, signupSchema } from "@/lib/validators";
import {
  createUser,
  EmailTakenError,
  findUserByEmail,
  linkAuthUid,
  updateUser,
} from "@/lib/users";
import { logEvent } from "@/lib/audit";
import { maskEmail } from "@/lib/utils";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo";
import type { User } from "@/lib/types";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

/**
 * Reduce any callback (relative or absolute) to a path on *this* origin, so
 * `?callbackUrl=https://evil.example` can never redirect off-site.
 */
function safeCallback(raw: FormDataEntryValue | null, fallback: string): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return fallback;
  let path: string;
  try {
    const u = new URL(value, "http://assura.local");
    path = `${u.pathname}${u.search}`;
  } catch {
    return fallback;
  }
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  if (path === "/" || path.startsWith("/login") || path.startsWith("/signup")) return fallback;
  return path;
}

/** True when a Supabase auth error is a rate-limit (HTTP 429 / known code). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isRateLimited(err: any): boolean {
  if (!err) return false;
  return (
    err.status === 429 ||
    err.code === "over_request_rate_limit" ||
    err.code === "over_email_send_rate_limit"
  );
}

/**
 * Resolve (and link) the app user for a just-authenticated Supabase identity.
 * Prefers auth_uid, falls back to email + back-fill. Returns null if no app row.
 */
async function resolveAppUser(
  authUid: string | undefined,
  email: string
): Promise<User | null> {
  const byEmail = await findUserByEmail(email);
  if (byEmail) {
    if (authUid && byEmail.authUid !== authUid) {
      await linkAuthUid(byEmail.id, authUid);
    }
    return byEmail;
  }
  return null;
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function loginAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const emailRaw = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeCallback(formData.get("callbackUrl"), "/compare");

  const parsed = loginSchema.safeParse({ email: emailRaw, password });
  if (!parsed.success) {
    return { error: "Please enter your email and password.", values: { email: emailRaw } };
  }
  const email = parsed.data.email.toLowerCase();

  const supabase = await getServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error) {
    if (isRateLimited(error)) {
      logEvent("system", "auth.login.locked", { email: maskEmail(email) });
      return {
        error: "Too many failed attempts. Please wait a few minutes and try again.",
        values: { email },
      };
    }
    logEvent("system", "auth.login.failed", { email: maskEmail(email) });
    return { error: "Invalid email or password.", values: { email } };
  }

  const appUser = await resolveAppUser(data.user?.id, email);
  if (!appUser) {
    // Authenticated with Supabase but no app row — treat as failed login.
    logEvent("system", "auth.login.failed", { email: maskEmail(email) });
    return { error: "Invalid email or password.", values: { email } };
  }

  logEvent(appUser.id, "auth.login.success", {});
  redirect(withToast(redirectTo, "login")); // NEXT_REDIRECT — propagates
}

/** Append ?toast=<key> to a path, preserving any existing query string. */
function withToast(path: string, key: string): string {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("toast", key);
  return `${base}?${params.toString()}`;
}

export async function demoLoginAction(formData: FormData): Promise<void> {
  const redirectTo = safeCallback(formData.get("callbackUrl"), "/compare");

  const supabase = await getServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (error) {
    if (isRateLimited(error)) {
      logEvent("system", "auth.login.locked", { email: maskEmail(DEMO_EMAIL) });
    } else {
      logEvent("system", "auth.login.failed", { email: maskEmail(DEMO_EMAIL) });
    }
    redirect("/login?error=demo");
  }

  const appUser = await resolveAppUser(data.user?.id, DEMO_EMAIL);
  if (!appUser) {
    logEvent("system", "auth.login.failed", { email: maskEmail(DEMO_EMAIL) });
    redirect("/login?error=demo");
  }

  logEvent(appUser!.id, "auth.login.success", {});
  redirect(withToast(redirectTo, "login"));
}

// ─── Sign up ──────────────────────────────────────────────────────────────────

export async function signupAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    tier: String(formData.get("tier") ?? "premium"),
  };
  const values = { name: raw.name, email: raw.email, tier: raw.tier };

  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors, values };
  }

  const email = parsed.data.email.toLowerCase();

  // 1. App-table precheck — never create a Supabase identity for an email that
  //    already has an app row (prevents orphaned Supabase identities).
  const existing = await findUserByEmail(email);
  if (existing) {
    return { fieldErrors: { email: new EmailTakenError().message }, values };
  }

  // 2. Create the Supabase identity.
  const supabase = await getServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    if (error && /already/i.test(error.message)) {
      return { fieldErrors: { email: new EmailTakenError().message }, values };
    }
    return { error: "Could not create your account. Please try again.", values };
  }
  const authUid = data.user.id;

  // 3. Always confirm the email server-side (removes dashboard-toggle reliance).
  const admin = getAdminClient();
  if (admin) {
    await admin.auth.admin.updateUserById(authUid, { email_confirm: true });
  }

  // 4. Create the app row, linked to the Supabase identity.
  let appUser: User;
  try {
    appUser = await createUser({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
      tier: parsed.data.tier,
      authUid,
    });
  } catch (err) {
    // 5. Compensation: delete the orphaned Supabase identity (rare race).
    if (admin) {
      await admin.auth.admin.deleteUser(authUid).catch(() => {});
    }
    if (err instanceof EmailTakenError) {
      return { fieldErrors: { email: err.message }, values };
    }
    return { error: "Could not create your account. Please try again.", values };
  }

  // 6. Stamp app_metadata (tier/onboarded/appUserId) and audit.
  await syncAuthMetadata(appUser.id);
  logEvent(appUser.id, "auth.signup", { tier: appUser.tier });

  redirect(
    parsed.data.tier === "premium" ? "/onboarding?toast=signup" : "/compare?toast=signup"
  );
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const session = await auth();
  if (session?.user?.id) logEvent(session.user.id, "auth.logout", {});
  await signOut({ redirectTo: "/?toast=loggedout" });
}

// ─── Delete account (self-service) ─────────────────────────────────────────────

/**
 * Permanently delete the signed-in user's account:
 *   1. audit the intent (while the actor id is still valid),
 *   2. remove the app data (threads + messages + users row, FK-safe),
 *   3. delete the Supabase Auth identity (admin),
 *   4. sign out and redirect home with a toast.
 *
 * The audit chain itself is preserved (append-only) — the deletion event stays
 * in it. Requires a typed confirmation from the dialog so it can't fire by
 * accident. The demo seed account is protected from self-deletion.
 */
export async function deleteAccountAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Require an explicit typed confirmation ("DELETE") from the dialog.
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    redirect("/compare?toast=delete-unconfirmed");
  }

  const userId = session.user.id;
  const email = session.user.email;

  // Protect the shared demo account (so a demo run can't nuke the seed user).
  if (email.toLowerCase() === DEMO_EMAIL.toLowerCase()) {
    redirect("/compare?toast=delete-demo-blocked");
  }

  // 1. Audit first — the actor id must exist when the entry is written.
  logEvent(userId, "auth.account.deleted", { email: maskEmail(email) });

  // 2. Remove app data (threads/messages/users row), FK-safe + transactional.
  await deleteUserCascade(userId);

  // 3. Delete the Supabase identity (best-effort; no-op if admin unavailable).
  const admin = getAdminClient();
  const serverClient = await getServerClient();
  const {
    data: { user: sbUser },
  } = await serverClient.auth.getUser();
  if (admin && sbUser?.id) {
    await admin.auth.admin.deleteUser(sbUser.id).catch(() => {});
  }

  // 4. Clear the session and leave.
  await signOut({ redirectTo: "/?toast=account-deleted" });
}

// ─── Free → Premium (demo, no payment) ────────────────────────────────────────

export async function upgradeToPremiumAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await updateUser(session.user.id, (u) => {
    u.tier = "premium";
  });
  logEvent(session.user.id, "user.tier_changed", { from: "free", to: "premium", payment: "demo" });
  await refreshSessionCookie();

  const back = withToast(safeCallback(formData.get("returnTo"), "/onboarding"), "upgraded");
  revalidatePath("/", "layout");
  redirect(back);
}
