import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient, syncSubscriptionEntitlement } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json(
      { error: "Stripe webhook or Supabase metadata sync is not configured." },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret
    );
  } catch {
    console.warn("[billing] Stripe webhook signature verification failed.");
    return NextResponse.json({ error: "Invalid Stripe webhook signature." }, { status: 400 });
  }

  if (
    event.type !== "customer.subscription.created" &&
    event.type !== "customer.subscription.updated" &&
    event.type !== "customer.subscription.deleted"
  ) {
    return NextResponse.json({ received: true });
  }

  try {
    await syncSubscriptionEntitlement(event.data.object as Stripe.Subscription);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[billing] Failed to synchronize Stripe subscription:", error);
    return NextResponse.json({ error: "Could not synchronize subscription." }, { status: 500 });
  }
}
