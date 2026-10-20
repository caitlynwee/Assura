import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { resolveOrCreateAuthUser } from "@/lib/users";
import { getUserByAuthUid } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const destination = new URL("/settings", url.origin);

  if (!code) {
    destination.searchParams.set("emailError", "invalid-link");
    return NextResponse.redirect(destination);
  }

  const supabase = await getServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error("[auth] Email confirmation callback failed:", exchangeError.message);
    destination.searchParams.set("emailError", "confirmation-failed");
    return NextResponse.redirect(destination);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.email) {
    console.error("[auth] Confirmed email could not be loaded:", userError?.message ?? "missing email");
    destination.searchParams.set("emailError", "confirmation-failed");
    return NextResponse.redirect(destination);
  }

  const previousUser = await getUserByAuthUid(user.id);
  const appUser = await resolveOrCreateAuthUser(user);
  if (!appUser) {
    console.error("[auth] Confirmed email could not be synced to the app account.");
    destination.searchParams.set("emailError", "email-conflict");
    return NextResponse.redirect(destination);
  }

  destination.searchParams.set(
    "email",
    previousUser?.email.toLowerCase() === user.email.toLowerCase()
      ? "pending"
      : "updated"
  );
  return NextResponse.redirect(destination);
}
