"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChatConversation } from "@/lib/types";

async function fetchConversations(): Promise<ChatConversation[]> {
  const res = await fetch("/api/chat/conversations", { cache: "no-store" });
  if (!res.ok) throw new Error();
  const data = await res.json();
  return data.conversations ?? [];
}

/** The signed-in user's active Plan Q&A conversations (newest activity first). */
export function useConversations() {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    return fetchConversations()
      .then((list) => {
        setConversations(list);
        setError(null);
      })
      .catch(() => setError("Couldn't load your chat history."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // State is only set inside the promise callbacks, never synchronously here.
    fetchConversations()
      .then((list) => {
        setConversations(list);
        setError(null);
      })
      .catch(() => setError("Couldn't load your chat history."))
      .finally(() => setLoading(false));
  }, []);

  /** Move a conversation to "Recently deleted". Returns true on success. */
  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/chat/conversations/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 404) return false;
    setConversations((prev) => prev.filter((c) => c.id !== id));
    return true;
  }, []);

  /** Bring a conversation back from "Recently deleted". */
  const restore = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/chat/conversations/${encodeURIComponent(id)}/restore`, {
        method: "POST",
      });
      if (!res.ok) return false;
      await refresh();
      return true;
    },
    [refresh]
  );

  return { conversations, loading, error, refresh, remove, restore };
}

export interface TrashedConversation extends ChatConversation {
  /** ISO time it will be permanently removed. */
  purgeAt: string;
}

/** The "Recently deleted" bin. Loads when `open` becomes true. */
export function useTrash(open: boolean) {
  const [items, setItems] = useState<TrashedConversation[]>([]);
  const [retentionDays, setRetentionDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    return fetch("/api/chat/trash", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setItems(data.conversations ?? []);
        if (typeof data.retentionDays === "number") setRetentionDays(data.retentionDays);
        setError(null);
      })
      .catch(() => setError("Couldn't load recently deleted chats."))
      .finally(() => setLoading(false));
  }, []);

  // Reload each time the bin opens (adjusting state during render, then fetch).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setLoading(true);
  }
  useEffect(() => {
    if (!open) return;
    fetch("/api/chat/trash", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setItems(data.conversations ?? []);
        if (typeof data.retentionDays === "number") setRetentionDays(data.retentionDays);
        setError(null);
      })
      .catch(() => setError("Couldn't load recently deleted chats."))
      .finally(() => setLoading(false));
  }, [open]);

  /** Delete one binned chat forever. */
  const deleteForever = useCallback(async (id: string) => {
    const res = await fetch(
      `/api/chat/conversations/${encodeURIComponent(id)}?permanent=true`,
      { method: "DELETE" }
    );
    if (!res.ok && res.status !== 404) return false;
    setItems((prev) => prev.filter((c) => c.id !== id));
    return true;
  }, []);

  /** Delete every binned chat forever. */
  const empty = useCallback(async () => {
    const res = await fetch("/api/chat/trash", { method: "DELETE" });
    if (!res.ok) return false;
    setItems([]);
    return true;
  }, []);

  /** Drop an item locally after it was restored elsewhere. */
  const forget = useCallback((id: string) => {
    setItems((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { items, retentionDays, loading, error, reload: load, deleteForever, empty, forget };
}
