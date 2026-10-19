export const dynamic = "force-dynamic";

import PlanTable from "@/components/compare/plan-table";
import PlanFilters from "@/components/compare/plan-filters";
import RunScraperButton from "@/components/compare/run-scraper-button";

export const metadata = { title: "Compare Plans — Assura" };

const CURRENT_COUNTRY = process.env.CURRENT_COUNTRY ?? "Singapore";

export default function ComparePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Compare Plans</h1>
          <p className="text-gray-500 text-sm mt-1">
            Top critical illness plans in{" "}
            <span className="font-medium text-gray-700">{CURRENT_COUNTRY}</span>.
            Data extracted from public insurer brochures.
          </p>
        </div>
        <RunScraperButton />
      </div>
      <PlanFilters />
      <PlanTable />
    </div>
  );
}
