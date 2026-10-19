"use client";

import { RotateCcwIcon, SearchIcon } from "lucide-react";
import { usePlanFilters } from "@/hooks/use-plans";
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
] as const;

type SortBy = "coverageAmount" | "premiums" | "illnessesCovered" | "planName";

export default function PlanFilters() {
  const { filters, setFilter, reset } = usePlanFilters();

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

        <div className="grid min-w-[180px] gap-1.5">
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

        <div className="grid min-w-[150px] gap-1.5">
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

        <div className="grid min-w-[170px] gap-1.5">
          <Label htmlFor="f-sort" className="text-xs text-muted-foreground">
            Sort by
          </Label>
          <Select
            value={filters.sortBy ?? ALL}
            onValueChange={(v) => setFilter("sortBy", v === ALL ? undefined : (v as SortBy))}
          >
            <SelectTrigger id="f-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Default</SelectItem>
              <SelectItem value="coverageAmount">Coverage amount</SelectItem>
              <SelectItem value="premiums">Premium (M/30)</SelectItem>
              <SelectItem value="illnessesCovered">Illnesses covered</SelectItem>
              <SelectItem value="planName">Plan name</SelectItem>
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
