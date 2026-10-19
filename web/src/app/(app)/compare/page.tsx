export const dynamic = "force-dynamic";

import PlanTable from "@/components/compare/plan-table";
import PlanFilters from "@/components/compare/plan-filters";
import PageHeader from "@/components/layout/page-header";

export const metadata = { title: "Compare Plans — Assura" };

export default function ComparePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Compare Plans"
        description="Critical illness plans from Singapore insurers. Every figure is sourced from a public brochure, with its “data as of” date."
      />
      <PlanFilters />
      <PlanTable />
    </div>
  );
}
