export const dynamic = "force-dynamic";

import AuditEventList from "@/components/activity/audit-event-list";
import VerifyChainButton from "@/components/activity/verify-chain-button";
import PageHeader from "@/components/layout/page-header";

export const metadata = { title: "Activity Log — Assura" };

export default function ActivityPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Log"
        description="Every action taken by Assura is logged here in a tamper-evident SHA-256 hash chain."
        actions={<VerifyChainButton />}
      />
      <AuditEventList />
    </div>
  );
}
