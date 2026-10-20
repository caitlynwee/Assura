export const dynamic = "force-dynamic";

import { Suspense } from "react";
import ChatWorkspace from "@/components/chat/chat-workspace";
import PageHeader from "@/components/layout/page-header";

export const metadata = { title: "Plan Q&A — Assura" };

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full space-y-4">
      <PageHeader
        title="Plan Q&A"
        description="Ask anything about critical illness plans. Answers are cited from brochure data — factual comparison, not financial advice."
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
