export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { upgradeToPremiumAction } from "@/app/_actions/auth";
import SubmitButton from "@/components/auth/submit-button";

export const metadata = { title: "Upgrade — Assura" };

const FEATURES = [
  ["AI outreach", "Assura drafts enquiries to up to 5 insurers. You edit and approve every email."],
  ["Masked inbox", "Insurers reply to a relay address. Your real email and phone stay private."],
  ["CRM", "Every thread tracked, quotes extracted, pushy or suspicious replies flagged."],
  ["Audit log", "Every AI action recorded in a tamper-evident hash chain you can verify."],
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Premium feature</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">Let Assura contact insurers for you</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your Free plan includes plan comparison and cited Q&amp;A. Premium adds AI-assisted outreach,
          with you in control of every message.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {FEATURES.map(([title, desc]) => (
          <div key={title} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="font-medium text-gray-900">{title}</p>
            <p className="mt-1 text-sm text-gray-600">{desc}</p>
          </div>
        ))}
      </div>

      <form action={upgradeToPremiumAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="returnTo" value={from === "/onboarding" || !from ? "/onboarding" : from} />
        <SubmitButton pendingText="Upgrading…">Upgrade to Premium (demo, no payment)</SubmitButton>
        <Link href="/compare" className="text-sm text-gray-500 hover:text-gray-900">
          Maybe later
        </Link>
      </form>
    </div>
  );
}
