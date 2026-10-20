"use client";

import { useState, useEffect, useCallback } from "react";
import type { PolicyDocument } from "@/lib/types";
import { useT } from "@/lib/i18n/client";

async function fetchDocuments(): Promise<PolicyDocument[]> {
  const res = await fetch("/api/policy-chat/documents", { cache: "no-store" });
  if (!res.ok) throw new Error();
  const data = await res.json();
  return data.documents ?? [];
}

export function usePolicyDocuments() {
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const t = useT().policyChat;

  const refresh = useCallback(() => {
    return fetchDocuments()
      .then((list) => {
        setDocuments(list);
        setFailed(false);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDocuments()
      .then((list) => {
        setDocuments(list);
        setFailed(false);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  const upload = useCallback(
    async (file: File): Promise<PolicyDocument | null> => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/policy-chat/documents", {
        method: "POST",
        body: form,
      });
      if (!res.ok) return null;
      const data = await res.json();
      const doc: PolicyDocument = data.document;
      setDocuments((prev) => [doc, ...prev]);
      return doc;
    },
    []
  );

  const rename = useCallback(async (id: string, title: string): Promise<boolean> => {
    const res = await fetch(`/api/policy-chat/documents/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) return false;
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, title } : d)));
    return true;
  }, []);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    const res = await fetch(`/api/policy-chat/documents/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 404) return false;
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    return true;
  }, []);

  const error = failed ? t.uploadError : null;
  return { documents, loading, error, refresh, upload, rename, remove };
}
