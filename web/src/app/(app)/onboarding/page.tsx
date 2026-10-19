import OnboardingForm from "@/components/onboarding/onboarding-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Onboarding — Fineprint" };

export default function OnboardingPage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Set up outreach
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Choose what information Fineprint may share with insurers on your
          behalf.
        </p>
      </div>
      <OnboardingForm />
    </div>
  );
}
