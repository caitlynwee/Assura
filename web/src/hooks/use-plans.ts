"use client";

import { useState, useEffect, useCallback } from "react";
import type { Plan } from "@/lib/types";

export type PlanSortBy = "coverageAmount" | "premium" | "illnessesCovered" | "planName";

export interface PlanFilters {
  insurerId?: string;
  minCoverage?: number;
  maxCoverage?: number;
  earlyStage?: "true" | "false";
  search?: string;
  // ── client-side only (never sent to /api/plans) ──
  /** Sorted in the browser so "premium" can use the user's own premium. */
  sortBy?: PlanSortBy;
  sortDir?: "asc" | "desc";
  /** Show every plan instead of only those matching the user's profile. */
  showAll?: boolean;
}

// Keys that are real /api/plans query params; everything else stays client-side.
const API_FILTER_KEYS = ["insurerId", "minCoverage", "maxCoverage", "earlyStage", "search"] as const;

// Shared filter state at module level so PlanTable and PlanFilters stay in sync
let sharedFilters: PlanFilters = {};
// Bumped by refreshPlans() to force a re-fetch from the DB without changing filters.
let refreshNonce = 0;
const listeners = new Set<() => void>();

function getFilters() { return sharedFilters; }
function setFilters(next: PlanFilters) {
  sharedFilters = next;
  listeners.forEach((l) => l());
}

/** Force all usePlans() consumers to re-fetch plans from the database (no scrape). */
export function refreshPlans() {
  refreshNonce += 1;
  listeners.forEach((l) => l());
}

/** Query string for the server-side filters only (sorting/toggles excluded). */
function apiQuery(filters: PlanFilters): string {
  const params = new URLSearchParams();
  for (const key of API_FILTER_KEYS) {
    const v = filters[key];
    if (v !== undefined && v !== "") params.set(key, String(v));
  }
  return params.toString();
}

export function usePlanFilters() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const setFilter = useCallback(<K extends keyof PlanFilters>(key: K, value: PlanFilters[K]) => {
    setFilters({ ...sharedFilters, [key]: value });
  }, []);

  const update = useCallback((patch: Partial<PlanFilters>) => {
    setFilters({ ...sharedFilters, ...patch });
  }, []);

  // Reset keeps the "show all" choice — it's a view preference, not a filter.
  const reset = useCallback(() => setFilters({ showAll: sharedFilters.showAll }), []);

  return { filters: getFilters(), setFilter, update, reset };
}

/** Plans from the database, refetched only when a server-side filter changes. */
export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const query = apiQuery(getFilters());
  // Include the refresh nonce so refreshPlans() re-fetches even when filters
  // are unchanged. The nonce is NOT sent to the API — it only keys the effect.
  const fetchKey = `${query}#${refreshNonce}`;

  // Mark loading as soon as the fetch key changes (adjusting state during render).
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== fetchKey;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/plans?${query}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        setPlans(d.plans ?? []);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load plans.");
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(fetchKey);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { plans, loading, error };
}
