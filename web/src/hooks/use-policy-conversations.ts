"use client";

import { useState, useEffect, useCallback } from "react";
import type { PolicyConversation } from "@/lib/types";
import { useT } from "@/lib/i18n/client";

export interface TrashedPolicyConversation extends PolicyConversation {
  purgeAt: string;
}

/** Active conversations for a given document, most recently updated first. */
export function usePolicyConversations(documentId: string | null) {
  const [conversations, setConversations] = useState<PolicyConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = useT().policyChat;

  const refresh = useCallback(() => {
    if (!documentId) return Promise.resolve();
    setLoading(true);
    return fetch(`/api/policy-chat/conversations?documentId=${encodeURIComponent(documentId)}`, {
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setConversations(data.conversations ?? []);
        setFailed(false);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [documentId]);

  useEffect(() => {
    if (!documentId) {
      setConversations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/policy-chat/conversations?documentId=${encodeURIComponent(documentId)}`, {
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setConversations(data.conversations ?? []);
        setFailed(false);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [documentId]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    const res = await fetch(`/api/policy-chat/conversations/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 404) return false;
    setConversations((prev) => prev.filter((c) => c.id !== id));
    return true;
  }, []);

  const restore = useCallback(
    async (id: string): Promise<boolean> => {
      const res = await fetch(
        `/api/policy-chat/conversations/${encodeURIComponent(id)}/restore`,
        { method: "POST" }
      );
      if (!res.ok) return false;
      await refresh();
      return true;
    },
    [refresh]
  );

  const error = failed ? t.loadHistoryFailed : null;
  return { conversations, loading, error, refresh, remove, restore };
}

/** Policy-chat "Recently deleted" bin. Loads when `open` becomes true. */
export function usePolicyTrash(open: boolean) {
  const [items, setItems] = useState<TrashedPolicyConversation[]>([]);
  const [retentionDays, setRetentionDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = useT().policyChat;

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setLoading(true);
  }

  useEffect(() => {
    if (!open) return;
    fetch("/api/policy-chat/trash", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setItems(data.conversations ?? []);
        if (typeof data.retentionDays === "number") setRetentionDays(data.retentionDays);
        setFailed(false);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [open]);

  const deleteForever = useCallback(async (id: string): Promise<boolean> => {
    const res = await fetch(
      `/api/policy-chat/conversations/${encodeURIComponent(id)}?permanent=true`,
      { method: "DELETE" }
    );
    if (!res.ok && res.status !== 404) return false;
    setItems((prev) => prev.filter((c) => c.id !== id));
    return true;
  }, []);

  const empty = useCallback(async (): Promise<boolean> => {
    const res = await fetch("/api/policy-chat/trash", { method: "DELETE" });
    if (!res.ok) return false;
    setItems([]);
    return true;
  }, []);

  const forget = useCallback((id: string) => {
    setItems((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const error = failed ? t.loadBinFailed : null;
  return { items, retentionDays, loading, error, deleteForever, empty, forget };
}
