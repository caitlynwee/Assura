import { NextRequest, NextResponse } from "next/server";
import { refreshSessionCookie } from "@/lib/auth";
import { safeBillingReturnTo } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const returnTo = safeBillingReturnTo(request.nextUrl.searchParams.get("from"));
  const session = await refreshSessionCookie();

  if (!session?.user.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session?.user.tier === "premium") {
    return NextResponse.redirect(new URL(returnTo, request.url));
  }

  const pendingUrl = new URL("/upgrade", request.url);
  pendingUrl.searchParams.set("checkout", "success");
  pendingUrl.searchParams.set("from", returnTo);
  return NextResponse.redirect(pendingUrl);
}
