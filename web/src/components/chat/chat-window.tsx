"use client";

import { useEffect, useRef } from "react";
import { MessagesSquareIcon } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ChatMessage from "./chat-message";
import ChatInput from "./chat-input";

const SUGGESTIONS = [
  "Which plans cover early-stage critical illness?",
  "Compare the cheapest plans for a 30-year-old non-smoker",
  "What are the common exclusions?",
];

export default function ChatWindow() {
  const { messages, sendMessage, streaming } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Card className="flex h-full flex-col gap-0 overflow-hidden py-0">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <MessagesSquareIcon className="size-6" />
            </div>
            <div>
              <p className="font-medium">Ask about critical illness plans</p>
              <p className="text-sm text-muted-foreground">Answers cite the brochure each fact comes from.</p>
            </div>
            <div className="flex max-w-xl flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <Button key={s} variant="outline" size="sm" onClick={() => sendMessage(s)} disabled={streaming}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {streaming && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3" aria-busy="true">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="w-1/2 space-y-2 pt-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t bg-muted/30 p-4">
        <ChatInput onSend={sendMessage} disabled={streaming} />
      </div>
    </Card>
  );
}
