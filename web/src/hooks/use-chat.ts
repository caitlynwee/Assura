"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";

interface Options {
  /** Called when the first message of a new chat creates a conversation. */
  onConversationCreated?: (id: string) => void;
  /** Called after each exchange so the history list can re-sort. */
  onActivity?: () => void;
  /** Called when the requested conversation doesn't exist (deleted / stale link). */
  onNotFound?: () => void;
}

/**
 * Plan Q&A chat bound to one saved conversation.
 * `conversationId === null` means a fresh, unsaved chat; the server creates
 * the conversation when the first message is sent.
 */
export function useChat(conversationId: string | null, options: Options = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(Boolean(conversationId));

  // Id of a conversation this hook just created — its messages are already in
  // state, so switching to it must not refetch (and wipe the live stream).
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Reset when the active conversation changes (adjusting state during render,
  // per https://react.dev/learn/you-might-not-need-an-effect).
  const [prevId, setPrevId] = useState(conversationId);
  if (prevId !== conversationId) {
    setPrevId(conversationId);
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      setCreatedId(null);
    } else if (conversationId !== createdId) {
      setMessages([]);
      setLoading(true);
      setCreatedId(null);
    }
  }

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!conversationId || conversationId === createdId) return;

    let cancelled = false;
    fetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          optionsRef.current.onNotFound?.();
          return;
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setMessages(data.messages ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setMessages([
            {
              role: "assistant",
              content: "Couldn't load this conversation. Please try again.",
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, createdId]);

  const sendMessage = useCallback(
    async (content: string) => {
      const userMsg: ChatMessage = {
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setStreaming(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            ...(conversationId ? { conversationId } : {}),
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error("Chat request failed");
        }

        const newId = res.headers.get("X-Conversation-Id");
        if (newId && newId !== conversationId) {
          setCreatedId(newId);
          optionsRef.current.onConversationCreated?.(newId);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "", timestamp: new Date().toISOString() },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantContent += decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], content: assistantContent };
            return next;
          });
        }
      } catch {
        setMessages((prev) => {
          // Drop an empty placeholder before showing the error.
          const next =
            prev[prev.length - 1]?.role === "assistant" && !prev[prev.length - 1].content
              ? prev.slice(0, -1)
              : prev;
          return [
            ...next,
            {
              role: "assistant",
              content: "Sorry, something went wrong. Please try again.",
              timestamp: new Date().toISOString(),
            },
          ];
        });
      } finally {
        setStreaming(false);
        optionsRef.current.onActivity?.();
      }
    },
    [conversationId]
  );

  return { messages, sendMessage, streaming, loading };
}
