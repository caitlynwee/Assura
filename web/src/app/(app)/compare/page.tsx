export const dynamic = "force-dynamic";

import PlanTable from "@/components/compare/plan-table";
import PlanFilters from "@/components/compare/plan-filters";
import PageHeader from "@/components/layout/page-header";
import RefreshPlansButton from "@/components/compare/refresh-plans-button";
import { getCurrentUser } from "@/lib/session";
import type { ComparePersonalProfile } from "@/lib/premium";
import { profileAge } from "@/lib/profile";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getT()).compare.meta };
}

export default async function ComparePage() {
  // Read the current user without redirecting — the no-profile path must still
  // render the default comparison. Pass ONLY the non-sensitive fields the client
  // needs for premium personalization (never health/income/occupation).
  const user = await getCurrentUser();
  const t = (await getT()).compare;
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
          title={t.title}
          description={t.description}
        />
        <RefreshPlansButton />
      </div>
      <PlanFilters />
      <PlanTable profile={profile} />
    </div>
  );
}
