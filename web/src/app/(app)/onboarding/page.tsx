export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { generateMaskedAddress } from "@/lib/mail";
import { maskEmail } from "@/lib/utils";
import OnboardingForm from "@/components/onboarding/onboarding-form";
import PageHeader from "@/components/layout/page-header";

export const metadata = { title: "Privacy & consent — Assura" };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.tier !== "premium") redirect("/upgrade?from=/onboarding");

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={user.onboarded ? "Privacy & consent" : "Set up outreach"}
        description="Choose what Assura may share with insurers on your behalf. You can change this any time."
      />
      <OnboardingForm
        realEmailMasked={maskEmail(user.email)}
        maskedInbox={user.maskedInbox || generateMaskedAddress(user.id)}
        initialConsent={user.consent}
        initialProfile={user.profile ?? {}}
        alreadyOnboarded={user.onboarded}
      />
    </div>
  );
}
