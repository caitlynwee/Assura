export const dynamic = "force-dynamic";

import ThreadList from "@/components/crm/thread-list";
import PageHeader from "@/components/layout/page-header";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getT()).crm.meta };
}

export default async function CrmPage() {
  const t = (await getT()).crm;
  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
      />
      <ThreadList />
    </div>
  );
}
