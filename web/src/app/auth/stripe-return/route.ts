import { NextRequest, NextResponse } from "next/server";
import { refreshSessionCookie } from "@/lib/auth";
import { getSiteUrl, safeBillingReturnTo } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const returnTo = safeBillingReturnTo(request.nextUrl.searchParams.get("from"));
  const session = await refreshSessionCookie();
  // Build redirects from the configured site origin, not the request host:
  // the container binds on HOSTNAME=0.0.0.0, so request.url would leak
  // http://0.0.0.0:3000 back to the browser.
  const siteUrl = getSiteUrl();

  if (!session?.user.id) {
    return NextResponse.redirect(new URL("/login", siteUrl));
  }

  if (session?.user.tier === "premium") {
    return NextResponse.redirect(new URL(returnTo, siteUrl));
  }

  const pendingUrl = new URL("/upgrade", siteUrl);
  pendingUrl.searchParams.set("checkout", "success");
  pendingUrl.searchParams.set("from", returnTo);
  return NextResponse.redirect(pendingUrl);
}
