export const dynamic = "force-dynamic";

import AuditEventList from "@/components/activity/audit-event-list";
import VerifyChainButton from "@/components/activity/verify-chain-button";

export const metadata = { title: "Activity Log — Fineprint" };

export default function ActivityPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Activity Log
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Every action taken by Fineprint is logged here with a tamper-evident
            hash chain.
          </p>
        </div>
        <VerifyChainButton />
      </div>
      <AuditEventList />
    </div>
  );
}
