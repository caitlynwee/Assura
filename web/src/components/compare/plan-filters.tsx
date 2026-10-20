"use client";

import { RotateCcwIcon, SearchIcon } from "lucide-react";
import { usePlanFilters, type PlanSortBy } from "@/hooks/use-plans";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Radix Select items can't use "" as a value, so "all" stands for "no filter".
const ALL = "all";

const INSURERS = [
  ["aia", "AIA Singapore"],
  ["prudential", "Prudential"],
  ["greateastern", "Great Eastern"],
  ["income", "NTUC Income"],
  ["manulife", "Manulife"],
  ["singlife", "Singlife"],
] as const;

/** Coverage (sum assured) bands → [minCoverage, maxCoverage] for /api/plans. */
export const COVERAGE_RANGES: Record<string, { label: string; min?: number; max?: number }> = {
  "0-50000": { label: "Up to S$50k", max: 50_000 },
  "50001-100000": { label: "S$50k – S$100k", min: 50_001, max: 100_000 },
  "100001-200000": { label: "S$100k – S$200k", min: 100_001, max: 200_000 },
  "200001-": { label: "Above S$200k", min: 200_001 },
};

/** Sort choices as "<field>:<direction>" so one dropdown sets both. */
const SORTS: Array<[string, string]> = [
  ["coverageAmount:desc", "Coverage: high to low"],
  ["coverageAmount:asc", "Coverage: low to high"],
  ["premium:asc", "Premium: low to high"],
  ["premium:desc", "Premium: high to low"],
  ["illnessesCovered:desc", "Most illnesses covered"],
  ["planName:asc", "Plan name (A–Z)"],
];

function coverageKey(min?: number, max?: number): string {
  const hit = Object.entries(COVERAGE_RANGES).find(([, r]) => r.min === min && r.max === max);
  return hit ? hit[0] : ALL;
}

export default function PlanFilters() {
  const { filters, setFilter, update, reset } = usePlanFilters();
  const sortValue = filters.sortBy ? `${filters.sortBy}:${filters.sortDir ?? "asc"}` : ALL;

  return (
    <Card className="py-4">
      <CardContent className="flex flex-wrap items-end gap-4 px-4">
        <div className="grid min-w-[220px] flex-1 gap-1.5">
          <Label htmlFor="plan-search" className="text-xs text-muted-foreground">
            Search
          </Label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="plan-search"
              value={filters.search ?? ""}
              onChange={(e) => setFilter("search", e.target.value || undefined)}
              placeholder="Plan or insurer name"
              className="pl-8"
            />
          </div>
        </div>

        <div className="grid min-w-[170px] gap-1.5">
          <Label htmlFor="f-insurer" className="text-xs text-muted-foreground">
            Insurer
          </Label>
          <Select
            value={filters.insurerId ?? ALL}
            onValueChange={(v) => setFilter("insurerId", v === ALL ? undefined : v)}
          >
            <SelectTrigger id="f-insurer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All insurers</SelectItem>
              {INSURERS.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-[170px] gap-1.5">
          <Label htmlFor="f-coverage" className="text-xs text-muted-foreground">
            Coverage amount
          </Label>
          <Select
            value={coverageKey(filters.minCoverage, filters.maxCoverage)}
            onValueChange={(v) => {
              const r = v === ALL ? undefined : COVERAGE_RANGES[v];
              update({ minCoverage: r?.min, maxCoverage: r?.max });
            }}
          >
            <SelectTrigger id="f-coverage">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any amount</SelectItem>
              {Object.entries(COVERAGE_RANGES).map(([key, r]) => (
                <SelectItem key={key} value={key}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-[140px] gap-1.5">
          <Label htmlFor="f-early" className="text-xs text-muted-foreground">
            Early stage CI
          </Label>
          <Select
            value={filters.earlyStage ?? ALL}
            onValueChange={(v) => setFilter("earlyStage", v === ALL ? undefined : (v as "true" | "false"))}
          >
            <SelectTrigger id="f-early">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any</SelectItem>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-[190px] gap-1.5">
          <Label htmlFor="f-sort" className="text-xs text-muted-foreground">
            Sort by
          </Label>
          <Select
            value={sortValue}
            onValueChange={(v) => {
              if (v === ALL) return update({ sortBy: undefined, sortDir: undefined });
              const [by, dir] = v.split(":") as [PlanSortBy, "asc" | "desc"];
              update({ sortBy: by, sortDir: dir });
            }}
          >
            <SelectTrigger id="f-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Default</SelectItem>
              {SORTS.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
          <RotateCcwIcon />
          Reset
        </Button>
      </CardContent>
    </Card>
  );
}
