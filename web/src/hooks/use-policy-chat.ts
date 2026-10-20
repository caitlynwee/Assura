"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";
import { useT } from "@/lib/i18n/client";

interface Options {
  onConversationCreated?: (id: string) => void;
  onActivity?: () => void;
  onNotFound?: () => void;
}

/**
 * Policy-document chat. Mirrors useChat but posts to /api/policy-chat with
 * a required documentId in the body.
 */
export function usePolicyChat(
  documentId: string | null,
  conversationId: string | null,
  options: Options = {}
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const t = useT().policyChat;
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(Boolean(conversationId));
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [prevKey, setPrevKey] = useState(`${documentId}:${conversationId}`);
  const currentKey = `${documentId}:${conversationId}`;
  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
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
    fetch(`/api/policy-chat/conversations/${encodeURIComponent(conversationId)}`, {
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
              content: t.loadChatFailed,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, createdId]);

  const runExchange = useCallback(
    async (content: string, base: ChatMessage[], editMessageId?: string) => {
      if (!documentId) return;
      const userMsg: ChatMessage = {
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };
      setMessages([...base, userMsg]);
      setStreaming(true);

      try {
        const res = await fetch("/api/policy-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            documentId,
            ...(conversationId ? { conversationId } : {}),
            ...(editMessageId ? { editMessageId } : {}),
          }),
        });

        if (!res.ok || !res.body) throw new Error("Chat request failed");

        const newId = res.headers.get("X-Conversation-Id");
        if (newId && newId !== conversationId) {
          setCreatedId(newId);
          optionsRef.current.onConversationCreated?.(newId);
        }

        const userMsgId = res.headers.get("X-User-Message-Id") ?? undefined;
        const assistantMsgId = res.headers.get("X-Assistant-Message-Id") ?? undefined;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";

        setMessages((prev) => {
          const next = [...prev];
          const userIdx = base.length;
          if (next[userIdx]) next[userIdx] = { ...next[userIdx], id: userMsgId };
          next.push({
            id: assistantMsgId,
            role: "assistant",
            content: "",
            timestamp: new Date().toISOString(),
          });
          return next;
        });

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
          const next =
            prev[prev.length - 1]?.role === "assistant" && !prev[prev.length - 1].content
              ? prev.slice(0, -1)
              : prev;
          return [
            ...next,
            {
              role: "assistant",
              content: t.genericError,
              timestamp: new Date().toISOString(),
            },
          ];
        });
      } finally {
        setStreaming(false);
        optionsRef.current.onActivity?.();
      }
    },
    [documentId, conversationId, t]
  );

  const sendMessage = useCallback(
    (content: string) => runExchange(content, messages),
    [runExchange, messages]
  );

  const editMessage = useCallback(
    (messageId: string, content: string) => {
      const idx = messages.findIndex((m) => m.id === messageId && m.role === "user");
      if (idx === -1 || !conversationId) return Promise.resolve();
      return runExchange(content, messages.slice(0, idx), messageId);
    },
    [runExchange, messages, conversationId]
  );

  return { messages, sendMessage, editMessage, streaming, loading };
}
