export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { InboxIcon, LockKeyholeIcon, ScrollTextIcon, SendIcon, SparklesIcon, type LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/session";
import { upgradeToPremiumAction } from "@/app/_actions/auth";
import SubmitButton from "@/components/auth/submit-button";
import PageHeader from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await requireUser();
  const { from } = await searchParams;
  if (user.tier === "premium") redirect(from?.startsWith("/") && !from.startsWith("//") ? from : "/outreach");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Premium feature"
        title="Let Assura contact insurers for you"
        description="Your Free plan includes plan comparison and cited Q&A. Premium adds AI-assisted outreach, with you in control of every message."
      />

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

      <form action={upgradeToPremiumAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="returnTo" value={from === "/onboarding" || !from ? "/onboarding" : from} />
        <SubmitButton pendingText="Upgrading…">
          <SparklesIcon />
          Upgrade to Premium (demo, no payment)
        </SubmitButton>
        <Button asChild variant="ghost">
          <Link href="/compare">Maybe later</Link>
        </Button>
      </form>
    </div>
  );
}
