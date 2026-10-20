"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { findUserById } from "@/lib/users";
import { getSiteUrl, getStripeClient, getStripePriceId, safeBillingReturnTo } from "@/lib/stripe";

export async function startPremiumCheckoutAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.tier === "premium") redirect("/onboarding");

  try {
    const user = await findUserById(session.user.id);
    if (!user) throw new Error("Your account could not be found.");

    const stripe = getStripeClient();
    const siteUrl = getSiteUrl();
    const returnTo = safeBillingReturnTo(formData.get("returnTo"));
    const price = await stripe.prices.retrieve(getStripePriceId());
    if (!price.active || price.type !== "recurring" || price.currency !== "sgd") {
      throw new Error("The configured Premium price must be active, recurring, and in SGD.");
    }
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
      client_reference_id: user.id,
      customer: user.stripeCustomerId ?? undefined,
      customer_email: user.stripeCustomerId ? undefined : user.email,
      metadata: { appUserId: user.id },
      subscription_data: { metadata: { appUserId: user.id } },
      success_url: `${siteUrl}/auth/stripe-return?from=${encodeURIComponent(returnTo)}`,
      cancel_url: `${siteUrl}/upgrade?checkout=cancelled`,
    });

    if (!checkout.url) throw new Error("Stripe did not return a checkout URL.");
    redirect(checkout.url);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error("[billing] Could not create Stripe Checkout session:", error);
    redirect(
      error instanceof Error &&
      (error.message.includes("not configured") || error.message.includes("Configure STRIPE_PRICE_ID"))
        ? "/upgrade?error=not-configured"
        : "/upgrade?error=checkout-failed"
    );
  }
}

export async function openBillingPortalAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  try {
    const user = await findUserById(session.user.id);
    if (!user?.stripeCustomerId) redirect("/settings?billing=unavailable");

    const stripe = getStripeClient();
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${getSiteUrl()}/settings`,
    });
    redirect(portal.url);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error("[billing] Could not open Stripe Billing Portal:", error);
    redirect("/settings?billing=error");
  }
}
