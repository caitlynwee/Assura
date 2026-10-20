"use client";

import { useEffect, useRef, useState } from "react";
import { FileTextIcon, SendHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import ChatMessage from "@/components/chat/chat-message";
import { useT } from "@/lib/i18n/client";

interface Props {
  messages: ChatMessageType[];
  sendMessage: (message: string) => void;
  editMessage?: (messageId: string, content: string) => void;
  streaming: boolean;
  loading?: boolean;
}

export default function PolicyChatWindow({
  messages,
  sendMessage,
  editMessage,
  streaming,
  loading,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const t = useT().policyChat;
  const [value, setValue] = useState("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  const disabled = streaming || loading;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {loading && (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="ml-auto h-10 w-1/2" />
            <Skeleton className="h-20 w-3/4" />
            <Skeleton className="ml-auto h-10 w-2/5" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <FileTextIcon className="size-6" />
            </div>
            <div>
              <p className="font-medium">{t.emptyTitle}</p>
              <p className="text-sm text-muted-foreground">{t.emptyBody}</p>
            </div>
            <div className="flex max-w-xl flex-wrap justify-center gap-2">
              {t.suggestions.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  onClick={() => sendMessage(s)}
                  disabled={!!disabled}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}
        {!loading &&
          messages.map((msg, i) => (
            <ChatMessage
              key={msg.id ?? `local-${i}`}
              message={msg}
              onEdit={
                editMessage && msg.role === "user" && msg.id && !streaming
                  ? (content) => editMessage(msg.id!, content)
                  : undefined
              }
            />
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
        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.inputPlaceholder}
            disabled={!!disabled}
            rows={2}
            aria-label={t.inputLabel}
            className="min-h-0 flex-1 resize-none bg-card"
          />
          <Button type="submit" disabled={!!disabled || !value.trim()}>
            <SendHorizontalIcon />
            {t.send}
          </Button>
        </form>
      </div>
    </div>
  );
}
