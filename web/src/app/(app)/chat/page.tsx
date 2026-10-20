export const dynamic = "force-dynamic";

import { Suspense } from "react";
import ChatWorkspace from "@/components/chat/chat-workspace";
import PageHeader from "@/components/layout/page-header";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getT()).chat.meta };
}

export default async function ChatPage() {
  const t = (await getT()).chat;
  return (
    <div className="flex flex-col h-full space-y-4">
      <PageHeader
        title={t.title}
        description={t.description}
      />
      <div className="flex-1 min-h-0">
        {/* useSearchParams (active chat id) needs a Suspense boundary. */}
        <Suspense fallback={null}>
          <ChatWorkspace />
        </Suspense>
      </div>
    </div>
  );
}
