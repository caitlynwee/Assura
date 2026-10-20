export const dynamic = "force-dynamic";

import PlanTable from "@/components/compare/plan-table";
import PlanFilters from "@/components/compare/plan-filters";
import PageHeader from "@/components/layout/page-header";
import RunScraperButton from "@/components/compare/run-scraper-button";
import { getCurrentUser } from "@/lib/session";
import type { ComparePersonalProfile } from "@/lib/premium";
import { profileAge } from "@/lib/profile";

export const metadata = { title: "Compare Plans — Assura" };

export default async function ComparePage() {
  // Read the current user without redirecting — the no-profile path must still
  // render the default comparison. Pass ONLY the non-sensitive fields the client
  // needs for premium personalization (never health/income/occupation).
  const user = await getCurrentUser();
  const p = user?.profile;
  const profile: ComparePersonalProfile | undefined = p
    ? {
        age: profileAge(p),
        gender: p.gender,
        smoker: p.smoker,
        monthlyBudget: p.monthlyBudget,
        coverageNeeded: p.coverageNeeded,
      }
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader
          title="Compare Plans"
          description="Critical illness plans from Singapore insurers. Every figure is sourced from a public brochure, with its &ldquo;data as of&rdquo; date."
        />
        <RunScraperButton />
      </div>
      <PlanFilters hasBudget={typeof profile?.monthlyBudget === "number"} />
      <PlanTable profile={profile} />
    </div>
  );
}
