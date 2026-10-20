"use client";

import { usePlans } from "@/hooks/use-plans";
import { formatCurrency } from "@/lib/utils";
import Badge from "@/components/ui/badge";
import Spinner from "@/components/ui/spinner";

export default function PlanTable() {
  const { plans, loading, error } = usePlans();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <p className="text-red-600 text-sm">{error}</p>;
  }

  const visiblePlans = plans.filter((p) => p.coverageAmount > 0);

  if (!visiblePlans.length) {
    return <p className="text-gray-400 text-sm">No plans match your filters.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <th className="px-4 py-3 text-left">Plan</th>
            <th className="px-4 py-3 text-right">Coverage</th>
            <th className="px-4 py-3 text-right">Premium (M/30)</th>
            <th className="px-4 py-3 text-center">Illnesses</th>
            <th className="px-4 py-3 text-center">Early stage</th>
            <th className="px-4 py-3 text-left">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {visiblePlans.map((plan) => (
            <tr key={plan.id} className="hover:bg-gray-50 transition">
              <td className="px-4 py-3">
                <p className="font-medium text-gray-900">{plan.planName}</p>
                <p className="text-gray-400 text-xs">{plan.insurerName}</p>
              </td>
              <td className="px-4 py-3 text-right font-medium">
                {formatCurrency(plan.coverageAmount)}
              </td>
              <td className="px-4 py-3 text-right text-gray-600">
                {plan.premiums.male_30_nonsmoker
                  ? formatCurrency(plan.premiums.male_30_nonsmoker) + "/yr"
                  : "—"}
              </td>
              <td className="px-4 py-3 text-center">{plan.illnessesCovered}</td>
              <td className="px-4 py-3 text-center">
                {plan.earlyStageConditions ? (
                  <Badge variant="green">Yes</Badge>
                ) : (
                  <Badge variant="gray">No</Badge>
                )}
              </td>
              <td className="px-4 py-3 text-xs">
                <a
                  href={plan.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate block max-w-[160px]"
                >
                  Brochure
                </a>
                <span className="text-gray-400">as of {plan.dataAsOf}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
