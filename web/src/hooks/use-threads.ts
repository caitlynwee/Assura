"use client";

import { useState, useEffect } from "react";
import type { Thread } from "@/lib/types";

export function useThreads(statusFilter?: string) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = statusFilter ? `?status=${statusFilter}` : "";
    fetch(`/api/crm/threads${params}`)
      .then((r) => r.json())
      .then((d) => { setThreads(d.threads ?? []); setError(null); })
      .catch(() => setError("Failed to load threads."))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return { threads, loading, error };
}
