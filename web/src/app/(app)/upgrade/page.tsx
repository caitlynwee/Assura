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
import { getT } from "@/lib/i18n/server";
import { safeBillingReturnTo } from "@/lib/stripe";

export async function generateMetadata() {
  return { title: (await getT()).account.upgrade.meta };
}

const FEATURE_ICONS: LucideIcon[] = [SendIcon, LockKeyholeIcon, InboxIcon, ScrollTextIcon];

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; checkout?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { from, checkout, error } = await searchParams;
  const t = (await getT()).account.upgrade;
  const returnTo = safeBillingReturnTo(from ?? "/outreach");
  if (user.tier === "admin") {
    redirect(returnTo);
  }
  if (user.tier === "premium" && checkout !== "success") {
    redirect(`/auth/stripe-return?from=${encodeURIComponent(returnTo)}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      {checkout === "success" && (
        <Alert>
          <AlertDescription>
            {t.checkoutSuccess}
          </AlertDescription>
        </Alert>
      )}
      {checkout === "cancelled" && (
        <Alert>
          <AlertDescription>{t.checkoutCancelled}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error === "not-configured"
              ? t.notConfigured
              : t.checkoutFailed}
          </AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground">
        {t.recurring}
      </p>
      <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
        {t.testMode}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {t.features.map(({ title, desc }, i) => {
          const Icon = FEATURE_ICONS[i];
          return (
          <Card key={title} className="gap-0 py-5">
            <CardHeader className="px-5">
              <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{desc}</CardDescription>
            </CardHeader>
          </Card>
          );
        })}
      </div>

      {checkout === "success" ? (
        <Button asChild>
          <Link href={`/auth/stripe-return?from=${encodeURIComponent(returnTo)}`}>{t.continueToAssura}</Link>
        </Button>
      ) : (
        <form action={startPremiumCheckoutAction} className="flex flex-wrap items-center gap-3">
          <input
            type="hidden"
            name="returnTo"
            value={from === "/onboarding" || !from ? "/onboarding" : from}
          />
          <SubmitButton pendingText={t.upgrading}>
            <SparklesIcon />
            {t.continueCheckout}
          </SubmitButton>
          <Button asChild variant="ghost">
            <Link href="/compare">{t.maybeLater}</Link>
          </Button>
        </form>
      )}
    </div>
  );
}
