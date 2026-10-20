"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChatConversation } from "@/lib/types";

/** The signed-in user's saved Plan Q&A conversations (newest activity first). */
export function useConversations() {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    return fetch("/api/chat/conversations", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setConversations(data.conversations ?? []);
        setError(null);
      })
      .catch(() => setError("Couldn't load your chat history."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // State is only set inside the fetch callbacks, never synchronously here.
    fetch("/api/chat/conversations", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setConversations(data.conversations ?? []);
        setError(null);
      })
      .catch(() => setError("Couldn't load your chat history."))
      .finally(() => setLoading(false));
  }, []);

  /** Permanently delete a conversation. Returns true on success. */
  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/chat/conversations/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 404) return false;
    setConversations((prev) => prev.filter((c) => c.id !== id));
    return true;
  }, []);

  return { conversations, loading, error, refresh, remove };
}
