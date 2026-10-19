"use client";

import { usePlanFilters } from "@/hooks/use-plans";

export default function PlanFilters() {
  const { filters, setFilter, reset } = usePlanFilters();

  return (
    <div className="bg-white border rounded-xl p-4 flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1 min-w-[180px]">
        <label className="text-xs text-gray-500 font-medium">Insurer</label>
        <select
          value={filters.insurerId ?? ""}
          onChange={(e) => setFilter("insurerId", e.target.value || undefined)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All insurers</option>
          <option value="aia">AIA Singapore</option>
          <option value="prudential">Prudential</option>
          <option value="greateastern">Great Eastern</option>
          <option value="income">NTUC Income</option>
          <option value="manulife">Manulife</option>
        </select>
      </div>

      <div className="flex flex-col gap-1 min-w-[150px]">
        <label className="text-xs text-gray-500 font-medium">Early stage CI</label>
        <select
          value={filters.earlyStage ?? ""}
          onChange={(e) => setFilter("earlyStage", (e.target.value as "true" | "false") || undefined)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>

      <div className="flex flex-col gap-1 min-w-[160px]">
        <label className="text-xs text-gray-500 font-medium">Sort by</label>
        <select
          value={filters.sortBy ?? ""}
          onChange={(e) =>
            setFilter("sortBy", (e.target.value as "coverageAmount" | "premiums" | "illnessesCovered" | "planName") || undefined)
          }
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Default</option>
          <option value="coverageAmount">Coverage amount</option>
          <option value="premiums">Premium (M/30)</option>
          <option value="illnessesCovered">Illnesses covered</option>
          <option value="planName">Plan name</option>
        </select>
      </div>

      <button
        onClick={reset}
        className="text-xs text-gray-400 hover:text-gray-600 underline self-end pb-2"
      >
        Reset filters
      </button>
    </div>
  );
}
