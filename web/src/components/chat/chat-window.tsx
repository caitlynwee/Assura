"use client";

import { useChat } from "@/hooks/use-chat";
import ChatMessage from "./chat-message";
import ChatInput from "./chat-input";
import Spinner from "@/components/ui/spinner";
import { useEffect, useRef } from "react";

export default function ChatWindow() {
  const { messages, sendMessage, streaming } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-white border rounded-xl overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Ask anything about critical illness insurance plans.
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {streaming && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Spinner className="h-4 w-4" />
            Thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t p-4">
        <ChatInput onSend={sendMessage} disabled={streaming} />
      </div>
    </div>
  );
}
