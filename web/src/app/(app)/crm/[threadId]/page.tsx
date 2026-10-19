export const dynamic = "force-dynamic";

import ThreadDetail from "@/components/crm/thread-detail";

export const metadata = { title: "Thread — Fineprint" };

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Thread</h1>
        <p className="text-gray-400 font-mono text-xs mt-1">{threadId}</p>
      </div>
      <ThreadDetail threadId={threadId} />
    </div>
  );
}
