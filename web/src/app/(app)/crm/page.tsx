export const dynamic = "force-dynamic";

import ThreadList from "@/components/crm/thread-list";
import PageHeader from "@/components/layout/page-header";

export const metadata = { title: "CRM — Assura" };

export default function CrmPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox & CRM"
        description="All outreach threads with insurers. Track status, review quotes, and flag suspicious replies."
      />
      <ThreadList />
    </div>
  );
}
