export const dynamic = "force-dynamic";

import ChatWindow from "@/components/chat/chat-window";

export const metadata = { title: "Plan Q&A — Assura" };

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Plan Q&A</h1>
        <p className="text-gray-500 text-sm mt-1">
          Ask anything about critical illness plans. All answers are cited from
          brochure data.
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <ChatWindow />
      </div>
    </div>
  );
}
