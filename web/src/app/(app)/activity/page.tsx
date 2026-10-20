export const dynamic = "force-dynamic";

import AuditEventList from "@/components/activity/audit-event-list";
import VerifyChainButton from "@/components/activity/verify-chain-button";
import PageHeader from "@/components/layout/page-header";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getT()).activity.meta };
}

export default async function ActivityPage() {
  const t = (await getT()).activity;
  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={<VerifyChainButton />}
      />
      <AuditEventList />
    </div>
  );
}
