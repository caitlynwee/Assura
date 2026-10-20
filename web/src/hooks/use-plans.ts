"use client";

import { useState, useEffect, useCallback } from "react";
import type { Plan } from "@/lib/types";

interface PlanFilters {
  insurerId?: string;
  minCoverage?: number;
  maxCoverage?: number;
  earlyStage?: "true" | "false";
  sortBy?: "coverageAmount" | "premiums" | "illnessesCovered" | "planName";
  sortDir?: "asc" | "desc";
  search?: string;
  // Emphasis-only flag for the "Within my budget" toggle. Never sent to the API
  // (plans are emphasized, never hidden) — see the param-building loop below.
  withinBudgetOnly?: boolean;
}

// Filter keys that are NOT real /api/plans query params — kept client-side only.
const NON_API_FILTER_KEYS: ReadonlySet<string> = new Set(["withinBudgetOnly"]);

// Shared filter state at module level so PlanTable and PlanFilters stay in sync
let sharedFilters: PlanFilters = {};
const listeners = new Set<() => void>();

function getFilters() { return sharedFilters; }
function setFilters(next: PlanFilters) {
  sharedFilters = next;
  listeners.forEach((l) => l());
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

  const reset = useCallback(() => setFilters({}), []);

  return { filters: getFilters(), setFilter, reset };
}

export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  useEffect(() => {
    const filters = getFilters();
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      // Skip emphasis-only keys so the API request shape stays unchanged.
      if (v !== undefined && !NON_API_FILTER_KEYS.has(k)) params.set(k, String(v));
    });

    setLoading(true);
    fetch(`/api/plans?${params}`)
      .then((r) => r.json())
      .then((d) => { setPlans(d.plans ?? []); setError(null); })
      .catch(() => setError("Failed to load plans."))
      .finally(() => setLoading(false));
  }, [sharedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  return { plans, loading, error };
}
