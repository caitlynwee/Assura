export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { InboxIcon, LockKeyholeIcon, ScrollTextIcon, SendIcon, SparklesIcon, type LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/session";
import { startPremiumCheckoutAction } from "@/app/_actions/billing";
import SubmitButton from "@/components/auth/submit-button";
import PageHeader from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata = { title: "Upgrade — Assura" };

const FEATURES: [LucideIcon, string, string][] = [
  [SendIcon, "AI outreach", "Assura drafts enquiries to up to 5 insurers. You edit and approve every email."],
  [LockKeyholeIcon, "Masked inbox", "Insurers reply to a relay address. Your real email and phone stay private."],
  [InboxIcon, "CRM", "Every thread tracked, quotes extracted, pushy or suspicious replies flagged."],
  [ScrollTextIcon, "Audit log", "Every AI action recorded in a tamper-evident hash chain you can verify."],
];

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; checkout?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { from, checkout, error } = await searchParams;
  if (user.tier === "premium" || user.tier === "admin") {
    redirect(from?.startsWith("/") && !from.startsWith("//") ? from : "/outreach");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Premium feature"
        title="Let Assura contact insurers for you"
        description="Your Free plan includes plan comparison and cited Q&A. Premium adds AI-assisted outreach, with you in control of every message."
      />

      {checkout === "success" && (
        <Alert>
          <AlertDescription>
            Checkout completed. Premium access will turn on after Stripe confirms your subscription. Refresh this page in a moment if needed.
          </AlertDescription>
        </Alert>
      )}
      {checkout === "cancelled" && (
        <Alert>
          <AlertDescription>No payment was taken. You can start checkout whenever you are ready.</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error === "not-configured"
              ? "Stripe test billing is not configured yet. Please try again later."
              : "We couldn't start secure checkout. Please try again."}
          </AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground">
        Premium is a recurring subscription. Stripe shows the configured price and billing period before you pay.
      </p>
      <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
        Stripe test mode is enabled. Use a Stripe test payment method; no real payment will be collected.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map(([Icon, title, desc]) => (
          <Card key={title} className="gap-0 py-5">
            <CardHeader className="px-5">
              <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{desc}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <form action={startPremiumCheckoutAction} className="flex flex-wrap items-center gap-3">
        <input
          type="hidden"
          name="returnTo"
          value={from === "/onboarding" || !from ? "/onboarding" : from}
        />
        <SubmitButton pendingText="Upgrading…">
          <SparklesIcon />
          Continue to Stripe Checkout
        </SubmitButton>
        <Button asChild variant="ghost">
          <Link href="/compare">Maybe later</Link>
        </Button>
      </form>
    </div>
  );
}
