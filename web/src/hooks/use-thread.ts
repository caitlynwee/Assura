"use client";

import { useState, useEffect } from "react";
import type { Thread } from "@/lib/types";

export function useThread(threadId: string) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!threadId) return;
    fetch(`/api/crm/threads/${threadId}`)
      .then((r) => r.json())
      .then((d) => { setThread(d.thread ?? null); setError(null); })
      .catch(() => setError("Failed to load thread."))
      .finally(() => setLoading(false));
  }, [threadId]);

  return { thread, loading, error, setThread };
}
