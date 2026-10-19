"use client";

import { useState, useCallback } from "react";
import type { ChatMessage } from "@/lib/types";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: ChatMessage = {
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          history: messages,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Chat request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      // Add placeholder assistant message
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };
      setMessages([...updatedMessages, assistantMsg]);

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
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setStreaming(false);
    }
  }, [messages]);

  return { messages, sendMessage, streaming };
}
