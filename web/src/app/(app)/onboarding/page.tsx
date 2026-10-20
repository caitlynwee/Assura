export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { generateMaskedAddress } from "@/lib/mail";
import { maskEmail } from "@/lib/utils";
import OnboardingForm from "@/components/onboarding/onboarding-form";
import PageHeader from "@/components/layout/page-header";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getT()).account.onboarding.meta };
}

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.tier !== "premium" && user.tier !== "admin") redirect("/upgrade?from=/onboarding");
  const t = (await getT()).account.onboarding;

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={user.onboarded ? t.titleDone : t.titleSetup}
        description={t.description}
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
