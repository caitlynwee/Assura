export const dynamic = "force-dynamic";

import PlanTable from "@/components/compare/plan-table";
import PlanFilters from "@/components/compare/plan-filters";

export const metadata = { title: "Compare Plans — Fineprint" };

export default function ComparePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Compare Plans</h1>
        <p className="text-gray-500 text-sm mt-1">
          Critical illness plans from 5 Singapore insurers. Data sourced from
          public brochures.
        </p>
      </div>
      <PlanFilters />
      <PlanTable />
    </div>
  );
}
