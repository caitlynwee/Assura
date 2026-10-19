export const dynamic = "force-dynamic";

import ThreadDetail from "@/components/crm/thread-detail";
import PageHeader from "@/components/layout/page-header";

export const metadata = { title: "Thread — Assura" };

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thread"
        description={<span className="font-mono text-xs">{threadId}</span>}
      />
      <ThreadDetail threadId={threadId} />
    </div>
  );
}
