export const dynamic = "force-dynamic";

import ThreadDetail from "@/components/crm/thread-detail";
import PageHeader from "@/components/layout/page-header";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getT()).crm.threadMeta };
}

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const t = (await getT()).crm;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.threadTitle}
        description={<span className="font-mono text-xs">{threadId}</span>}
      />
      <ThreadDetail threadId={threadId} />
    </div>
  );
}
