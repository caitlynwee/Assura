export const dynamic = "force-dynamic";

import ThreadList from "@/components/crm/thread-list";

export const metadata = { title: "CRM — Fineprint" };

export default function CrmPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Inbox & CRM</h1>
        <p className="text-gray-500 text-sm mt-1">
          All outreach threads with insurers. Track status, review quotes, and
          flag suspicious replies.
        </p>
      </div>
      <ThreadList />
    </div>
  );
}
