export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { generateMaskedAddress } from "@/lib/mail";
import { maskEmail } from "@/lib/utils";
import OnboardingForm from "@/components/onboarding/onboarding-form";

export const metadata = { title: "Privacy & consent — Assura" };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.tier !== "premium") redirect("/upgrade?from=/onboarding");

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {user.onboarded ? "Privacy & consent" : "Set up outreach"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Choose what Assura may share with insurers on your behalf. You can change this any time.
        </p>
      </div>
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
