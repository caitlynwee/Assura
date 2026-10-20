import type Stripe from "stripe";
import { resetDatabase } from "./setup";
import type { StripeSubscriptionState } from "@/lib/stripe";

jest.mock("@/lib/supabase/ensure-demo-user", () => ({
  syncAuthMetadata: jest.fn(async () => {}),
  ensureDemoAuthUser: jest.fn(async () => {}),
}));
jest.mock("@/lib/audit", () => ({
  logEvent: jest.fn(async () => {}),
}));

import { createUser, findUserById, updateUser, toPublicUser } from "@/lib/users";
import { syncSubscriptionEntitlement, getStripeClient, getStripePriceId } from "@/lib/stripe";
import { syncAuthMetadata } from "@/lib/supabase/ensure-demo-user";
import { logEvent } from "@/lib/audit";
import { evaluateRoute } from "@/lib/auth-routing";
import { signupSchema } from "@/lib/validators";
import { NextRequest } from "next/server";
import { POST as stripeWebhookPOST } from "@/app/api/stripe/webhook/route";

const originalStripeSecretKey = process.env.STRIPE_SECRET_KEY;
const originalStripePriceId = process.env.STRIPE_PRICE_ID;
const originalStripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const originalSupabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function makeSubscription(
  id: string,
  status: Stripe.Subscription.Status
): StripeSubscriptionState {
  return {
    id,
    customer: "cus_test_123",
    status,
    metadata: { appUserId: "user_demo" },
  };
}

describe("Stripe subscription entitlement", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await resetDatabase();
    await createUser({
      id: "user_billing_test",
      name: "Billing Test",
      email: "billing-test@example.com",
      password: "unused-password",
      tier: "free",
    });
  });

  it("grants Premium only for an active Stripe subscription and removes it when canceled", async () => {
    await syncSubscriptionEntitlement({
      ...makeSubscription("sub_test_1", "active"),
      metadata: { appUserId: "user_billing_test" },
    });
    expect(await findUserById("user_billing_test")).toMatchObject({
      tier: "premium",
      stripeCustomerId: "cus_test_123",
      stripeSubscriptionId: "sub_test_1",
    });

    await syncSubscriptionEntitlement({
      ...makeSubscription("sub_test_1", "canceled"),
      metadata: { appUserId: "user_billing_test" },
    });
    expect(await findUserById("user_billing_test")).toMatchObject({
      tier: "free",
      stripeCustomerId: "cus_test_123",
      stripeSubscriptionId: null,
    });
    expect(syncAuthMetadata).toHaveBeenCalledTimes(2);
    expect(logEvent).toHaveBeenCalledWith("user_billing_test", "billing.subscription_synced", {
      subscriptionId: "sub_test_1",
      status: "canceled",
      tier: "free",
    });
  });

  it("does not let a stale cancellation revoke a newer subscription", async () => {
    await syncSubscriptionEntitlement({
      ...makeSubscription("sub_old", "active"),
      metadata: { appUserId: "user_billing_test" },
    });
    await syncSubscriptionEntitlement({
      ...makeSubscription("sub_new", "active"),
      metadata: { appUserId: "user_billing_test" },
    });
    await syncSubscriptionEntitlement({
      ...makeSubscription("sub_old", "canceled"),
      metadata: { appUserId: "user_billing_test" },
    });

    expect(await findUserById("user_billing_test")).toMatchObject({
      tier: "premium",
      stripeSubscriptionId: "sub_new",
    });
  });

  it("keeps the shared demo account Premium regardless of Stripe events", async () => {
    await syncSubscriptionEntitlement(makeSubscription("sub_demo", "canceled"));
    expect(await findUserById("user_demo")).toMatchObject({
      tier: "premium",
      stripeSubscriptionId: null,
    });
  });

  it("keeps Checkout's webhook route reachable without a user session", () => {
    expect(
      evaluateRoute({
        pathname: "/api/stripe/webhook",
        isLoggedIn: false,
        tier: "free",
      })
    ).toEqual({ type: "allow" });
  });

  it("prevents selecting Premium directly at signup", () => {
    const parsed = signupSchema.safeParse({
      name: "New User",
      email: "new@example.com",
      password: "secure123",
      confirmPassword: "secure123",
      tier: "premium",
    });
    expect(parsed.success).toBe(false);

    const freeSignup = signupSchema.safeParse({
      name: "New User",
      email: "new@example.com",
      password: "secure123",
      confirmPassword: "secure123",
    });
    expect(freeSignup.success && freeSignup.data.tier).toBe("free");
  });

  it("does not expose Stripe identifiers through the public-user projection", async () => {
    await updateUser("user_billing_test", (user) => {
      user.stripeCustomerId = "cus_private";
      user.stripeSubscriptionId = "sub_private";
    });
    const user = await findUserById("user_billing_test");

    expect(toPublicUser(user!)).not.toHaveProperty("stripeCustomerId");
    expect(toPublicUser(user!)).not.toHaveProperty("stripeSubscriptionId");
  });
});

describe("Stripe configuration", () => {
  afterEach(() => {
    if (originalStripeSecretKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalStripeSecretKey;
    if (originalStripePriceId === undefined) delete process.env.STRIPE_PRICE_ID;
    else process.env.STRIPE_PRICE_ID = originalStripePriceId;
    if (originalStripeWebhookSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = originalStripeWebhookSecret;
    if (originalSupabaseServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseServiceKey;
  });

  it("rejects live keys and requires a configured recurring Price ID", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_not-for-demo";
    expect(() => getStripeClient()).toThrow("restricted to test mode");

    delete process.env.STRIPE_SECRET_KEY;
    expect(() => getStripeClient()).toThrow("Stripe is not configured");

    process.env.STRIPE_PRICE_ID = "prod_not-a-price";
    expect(() => getStripePriceId()).toThrow("recurring Stripe test price");
  });

  it("rejects unsigned or invalidly signed webhook requests", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_billing_unit_test";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_billing_unit_test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";

    const response = await stripeWebhookPOST(
      new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=invalid" },
        body: "{}",
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid Stripe webhook signature." });
  });
});
