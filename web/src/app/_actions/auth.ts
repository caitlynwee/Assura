"use server";

/**
 * Auth server actions. Using Server Actions (rather than next-auth/react's
 * client signIn) means forms work without client JS and the password never
 * passes through client-side code beyond the form post.
 */

import { AuthError, CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth, refreshSessionCookie, signIn, signOut } from "@/lib/auth";
import { signupSchema } from "@/lib/validators";
import { createUser, EmailTakenError, updateUser } from "@/lib/users";
import { logEvent } from "@/lib/audit";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo";

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

function authErrorMessage(err: AuthError): string {
  if (err instanceof CredentialsSignin && err.code === "rate_limited") {
    return "Too many failed attempts. Please wait 15 minutes and try again.";
  }
  if (err.type === "CredentialsSignin") return "Invalid email or password.";
  return "Something went wrong signing you in. Please try again.";
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function loginAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeCallback(formData.get("callbackUrl"), "/compare");

  if (!email || !password) {
    return { error: "Please enter your email and password.", values: { email } };
  }

  try {
    await signIn("credentials", { email, password, redirectTo });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: authErrorMessage(err), values: { email } };
    }
    throw err; // NEXT_REDIRECT on success — must propagate
  }
  return {};
}

export async function demoLoginAction(formData: FormData): Promise<void> {
  const redirectTo = safeCallback(formData.get("callbackUrl"), "/compare");
  try {
    await signIn("credentials", {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      redirectTo,
    });
  } catch (err) {
    if (err instanceof AuthError) redirect("/login?error=demo");
    throw err;
  }
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

  try {
    const user = await createUser(parsed.data);
    logEvent(user.id, "auth.signup", { tier: user.tier });
  } catch (err) {
    if (err instanceof EmailTakenError) {
      return { fieldErrors: { email: err.message }, values };
    }
    return { error: "Could not create your account. Please try again.", values };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: parsed.data.tier === "premium" ? "/onboarding" : "/compare",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Account created, but sign-in failed. Please log in.", values };
    }
    throw err;
  }
  return {};
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const session = await auth();
  if (session?.user?.id) logEvent(session.user.id, "auth.logout", {});
  await signOut({ redirectTo: "/" });
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

  const back = safeCallback(formData.get("returnTo"), "/onboarding");
  revalidatePath("/", "layout");
  redirect(back);
}
