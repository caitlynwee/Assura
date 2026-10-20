import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { logEvent } from "@/lib/audit";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/schema";
import { syncAuthMetadata } from "@/lib/supabase/ensure-demo-user";
import { DEMO_EMAIL } from "@/lib/demo";

let stripeClient: Stripe | undefined;

export type StripeSubscriptionState = Pick<
  Stripe.Subscription,
  "id" | "customer" | "metadata" | "status"
>;

export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) throw new Error("Stripe is not configured.");
  if (!secretKey.startsWith("sk_test_")) {
    throw new Error("Stripe is restricted to test mode until live billing is explicitly enabled.");
  }
  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
}

export function getStripePriceId(): string {
  const priceId = process.env.STRIPE_PRICE_ID?.trim();
  if (!priceId?.startsWith("price_")) {
    throw new Error("Configure STRIPE_PRICE_ID with a recurring Stripe test price.");
  }
  return priceId;
}

export function getSiteUrl(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  const parsed = new URL(siteUrl);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS outside localhost.");
  }
  return parsed.origin;
}

export function safeBillingReturnTo(value: unknown): string {
  if (typeof value !== "string") return "/onboarding";
  const path = value.trim();
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.startsWith("/api/") ||
    path === "/upgrade"
  ) {
    return "/onboarding";
  }
  return path;
}

export async function syncSubscriptionEntitlement(
  subscription: StripeSubscriptionState
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  let appUserId = subscription.metadata.appUserId;

  const db = getDb();
  if (!appUserId) {
    const users = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.stripeCustomerId, customerId))
      .limit(1);
    appUserId = users[0]?.id;
  }
  if (!appUserId) {
    throw new Error(`No Assura account is linked to Stripe subscription ${subscription.id}.`);
  }

  const users = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      tier: schema.users.tier,
      stripeSubscriptionId: schema.users.stripeSubscriptionId,
    })
    .from(schema.users)
    .where(eq(schema.users.id, appUserId))
    .limit(1);
  const user = users[0];
  if (!user) throw new Error(`Assura account ${appUserId} was not found.`);
  if (user.email.toLowerCase() === DEMO_EMAIL) return;
  // Admin is sticky: a Stripe entitlement event must never downgrade an admin's
  // DB tier (which would then propagate to app_metadata via syncAuthMetadata).
  if (user.tier === "admin") return;

  const isEntitled = subscription.status === "active" || subscription.status === "trialing";
  if (
    !isEntitled &&
    user.stripeSubscriptionId &&
    user.stripeSubscriptionId !== subscription.id
  ) {
    return;
  }

  await db
    .update(schema.users)
    .set({
      tier: isEntitled ? "premium" : "free",
      stripeCustomerId: customerId,
      stripeSubscriptionId: isEntitled ? subscription.id : null,
    })
    .where(eq(schema.users.id, appUserId));

  await logEvent(appUserId, "billing.subscription_synced", {
    subscriptionId: subscription.id,
    status: subscription.status,
    tier: isEntitled ? "premium" : "free",
  });
  await syncAuthMetadata(appUserId);
}
