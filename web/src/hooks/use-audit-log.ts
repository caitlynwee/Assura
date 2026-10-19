"use client";

import { useState, useEffect } from "react";
import type { AuditEntry } from "@/lib/types";

export function useAuditLog(page = 1) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/audit?page=${page}`)
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries ?? []);
        setTotal(d.total ?? 0);
        setError(null);
      })
      .catch(() => setError("Failed to load audit log."))
      .finally(() => setLoading(false));
  }, [page]);

  return { entries, total, loading, error };
}
