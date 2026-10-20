import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { resolveOrCreateAuthUser } from "@/lib/users";
import { getUserByAuthUid } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const confirmationType = url.searchParams.get("type");
  const destination = new URL("/settings", url.origin);

  if (!code && !tokenHash) {
    destination.searchParams.set("emailError", "invalid-link");
    return NextResponse.redirect(destination);
  }

  const supabase = await getServerClient();
  const confirmationResult = tokenHash
    ? confirmationType === "email_change"
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email_change" })
      : {
          error: {
            message: "Unsupported email confirmation type",
          },
        }
    : code
      ? await supabase.auth.exchangeCodeForSession(code)
      : {
          error: {
            message: "Missing email confirmation code",
          },
        };

  if (confirmationResult.error) {
    console.error("[auth] Email confirmation callback failed:", confirmationResult.error.message);
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
