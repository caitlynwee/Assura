"use client";

import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ExternalLinkIcon,
  SearchXIcon,
  TriangleAlertIcon,
  UserRoundCheckIcon,
} from "lucide-react";
import Link from "next/link";
import { usePlans, usePlanFilters, type PlanSortBy } from "@/hooks/use-plans";
import { formatCurrency } from "@/lib/utils";
import { hasUsableProfile, resolvePremium, type ComparePersonalProfile } from "@/lib/premium";
import { activeCriteria, assessPlan, type PlanRelevance } from "@/lib/relevance";
import type { Plan } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Column {
  key: string;
  label: string;
  className: string;
  sort?: PlanSortBy;
  /** Direction a first click sorts in (money columns: biggest coverage / cheapest premium). */
  firstDir?: "asc" | "desc";
}

const COLUMNS: Column[] = [
  { key: "plan", label: "Plan", className: "pl-4", sort: "planName", firstDir: "asc" },
  { key: "coverage", label: "Coverage", className: "text-right", sort: "coverageAmount", firstDir: "desc" },
  { key: "premium", label: "Premium", className: "text-right", sort: "premium", firstDir: "asc" },
  { key: "illnesses", label: "Illnesses", className: "text-center", sort: "illnessesCovered", firstDir: "desc" },
  { key: "early", label: "Early stage", className: "text-center" },
  { key: "source", label: "Source", className: "pr-4" },
];

interface Row {
  plan: Plan;
  rel: PlanRelevance;
  premium: number | undefined;
  premiumExact: boolean;
  premiumLabel: string;
}

function sortRows(rows: Row[], by?: PlanSortBy, dir: "asc" | "desc" = "asc"): Row[] {
  if (!by) return rows;
  const value = (r: Row): number | string => {
    if (by === "planName") return r.plan.planName.toLowerCase();
    if (by === "coverageAmount") return r.plan.coverageAmount || (dir === "desc" ? -1 : Number.POSITIVE_INFINITY);
    if (by === "illnessesCovered") return r.plan.illnessesCovered;
    return r.premium ?? Number.POSITIVE_INFINITY; // no premium → always last
  };
  const sign = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (by === "premium" && va === Infinity) return vb === Infinity ? 0 : 1;
    if (by === "premium" && vb === Infinity) return -1;
    return va < vb ? -sign : va > vb ? sign : 0;
  });
}

/** One-line description of the profile fields in use, e.g. "Age 30 · Male · Smoker". */
function profileSummary(p: ComparePersonalProfile): string[] {
  const parts: string[] = [];
  if (typeof p.age === "number") parts.push(`Age ${p.age}`);
  if (p.gender === "male" || p.gender === "female") parts.push(p.gender === "male" ? "Male" : "Female");
  if (typeof p.smoker === "boolean") parts.push(p.smoker ? "Smoker" : "Non-smoker");
  if (typeof p.monthlyBudget === "number") parts.push(`Budget ${formatCurrency(p.monthlyBudget)}/mo`);
  if (typeof p.coverageNeeded === "number") parts.push(`Needs ${formatCurrency(p.coverageNeeded)} cover`);
  return parts;
}

const RULE_NOUN = { budget: "over budget", coverage: "below coverage need", age: "cover ends too soon" } as const;

export default function PlanTable({ profile }: { profile?: ComparePersonalProfile }) {
  const { plans, loading, error } = usePlans();
  const { filters, update } = usePlanFilters();

  const personalized = hasUsableProfile(profile);
  const criteria = activeCriteria(profile);
  const canMatch = criteria.length > 0;
  const showAll = !canMatch || (filters.showAll ?? false);

  const rows: Row[] = plans
    .map((plan) => {
      const resolved = resolvePremium(profile ?? {}, plan.premiums);
      return {
        plan,
        rel: assessPlan(plan, profile),
        premium: resolved.premium,
        premiumExact: resolved.isExactMatch,
        premiumLabel: resolved.matchedLabel,
      };
    });
  const matching = rows.filter((r) => r.rel.relevant);
  const hidden = rows.filter((r) => !r.rel.relevant);
  const visible = sortRows(showAll ? rows : matching, filters.sortBy, filters.sortDir);

  // Why plans are hidden, e.g. "5 over budget, 2 below coverage need".
  const hiddenReasons = criteria
    .map((rule) => {
      const n = hidden.filter((r) => r.rel.checks.some((c) => c.rule === rule && !c.passed)).length;
      return n > 0 ? `${n} ${RULE_NOUN[rule]}` : null;
    })
    .filter(Boolean)
    .join(", ");

  const smokerNote = profile?.smoker === true && rows.some((r) => r.rel.smokerRateMissing);
  const premiumHeader = personalized ? "Premium (you)" : "Premium (M/30)";

  function toggleSort(col: Column) {
    if (!col.sort) return;
    if (filters.sortBy === col.sort) {
      update({ sortDir: filters.sortDir === "asc" ? "desc" : "asc" });
    } else {
      update({ sortBy: col.sort, sortDir: col.firstDir ?? "asc" });
    }
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Profile matching bar ── */}
      {canMatch ? (
        <Card className="gap-2 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={!showAll}
                onCheckedChange={(v) => update({ showAll: v !== true })}
                aria-label="Only show plans that match my profile"
              />
              Only show plans that match my profile
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {profileSummary(profile!).map((part) => (
                <Badge key={part} variant="outline" className="font-normal">
                  {part}
                </Badge>
              ))}
              <Link href="/settings" className="text-xs font-medium text-primary hover:underline">
                Edit
              </Link>
            </div>
          </div>
          {!loading && (
            <p className="text-xs text-muted-foreground">
              {showAll
                ? `Showing all ${rows.length} plans · ${matching.length} match your profile.`
                : `Showing ${matching.length} of ${rows.length} plans that match your profile.`}
              {!showAll && hidden.length > 0 && ` Hidden: ${hiddenReasons}.`}
            </p>
          )}
        </Card>
      ) : (
        !loading && (
          <Alert>
            <UserRoundCheckIcon />
            <AlertDescription>
              <span>
                Add your age, budget and the coverage you need to see only the plans that fit you, with
                premiums for your profile.{" "}
                <Link href="/settings" className="font-medium text-primary hover:underline">
                  Add your details
                </Link>
              </span>
            </AlertDescription>
          </Alert>
        )
      )}

      {smokerNote && (
        <Alert>
          <TriangleAlertIcon />
          <AlertDescription>
            These brochures only publish non-smoker rates, so premiums shown (marked *) are non-smoker
            rates. Smokers usually pay more — confirm the exact premium with the insurer.
          </AlertDescription>
        </Alert>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map((c) => {
                const active = c.sort && filters.sortBy === c.sort;
                const label = c.key === "premium" ? premiumHeader : c.label;
                return (
                  <TableHead
                    key={c.key}
                    className={`text-xs uppercase tracking-wide text-muted-foreground ${c.className}`}
                    aria-sort={
                      active ? (filters.sortDir === "desc" ? "descending" : "ascending") : undefined
                    }
                  >
                    {c.sort ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c)}
                        className={cn(
                          "inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground",
                          active && "text-foreground"
                        )}
                        title={`Sort by ${label.toLowerCase()}`}
                      >
                        {label}
                        {active ? (
                          filters.sortDir === "desc" ? (
                            <ArrowDownIcon className="size-3.5" />
                          ) : (
                            <ArrowUpIcon className="size-3.5" />
                          )
                        ) : (
                          <ArrowUpDownIcon className="size-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      label
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {COLUMNS.map((c) => (
                    <TableCell key={c.key} className="py-4">
                      <Skeleton className="h-4 w-full max-w-28" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : visible.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLUMNS.length} className="py-12 text-center text-muted-foreground">
                  <SearchXIcon className="mx-auto mb-2 size-6" />
                  {!showAll && rows.length > 0 ? (
                    <>
                      <p>No plans match all of your profile ({hiddenReasons}).</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => update({ showAll: true })}
                      >
                        Show all plans
                      </Button>
                    </>
                  ) : (
                    "No plans match your filters."
                  )}
                </TableCell>
              </TableRow>
            ) : (
              visible.map(({ plan, rel, premium, premiumExact, premiumLabel }) => {
                const failed = rel.checks.filter((c) => !c.passed);
                const muted = canMatch && showAll && !rel.relevant;
                return (
                  <TableRow key={plan.id} className={muted ? "opacity-60" : undefined}>
                    <TableCell className="py-3 pl-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{plan.planName}</p>
                        {plan.updatedBadge && <Badge variant="orange">Updated</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{plan.insurerName}</p>
                      {canMatch && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="mt-1 inline-flex cursor-help">
                              {rel.relevant ? (
                                <Badge variant="green" className="font-normal">
                                  <CheckIcon />
                                  Matches your profile
                                </Badge>
                              ) : (
                                <Badge variant="red" className="font-normal">
                                  {failed[0]?.label.replace(/ \(.*\)$/, "")}
                                  {failed.length > 1 && ` +${failed.length - 1}`}
                                </Badge>
                              )}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <ul className="space-y-0.5">
                              {rel.checks.map((c) => (
                                <li key={c.rule}>
                                  {c.passed ? "✓" : "✗"} {c.label}
                                </li>
                              ))}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {plan.coverageAmount ? formatCurrency(plan.coverageAmount) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {premium !== undefined ? (
                        <>
                          {`${formatCurrency(premium)}/yr`}
                          {(rel.smokerRateMissing || (personalized && !premiumExact)) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help text-foreground"> *</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {rel.smokerRateMissing
                                  ? "Non-smoker rate — no smoker rate published"
                                  : `Closest available: ${premiumLabel}`}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <p className="text-xs">≈ {formatCurrency(Math.round(premium / 12))}/mo</p>
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{plan.illnessesCovered}</TableCell>
                    <TableCell className="text-center">
                      {plan.earlyStageConditions ? (
                        <Badge variant="green">Yes</Badge>
                      ) : (
                        <Badge variant="gray">No</Badge>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-xs">
                      <div className="flex flex-col gap-0.5">
                        {plan.sourceUrl && (
                          <a
                            href={plan.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                          >
                            Brochure
                            <ExternalLinkIcon className="size-3" />
                          </a>
                        )}
                        {plan.productUrl && (
                          <a
                            href={plan.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary hover:underline"
                          >
                            Product page
                            <ExternalLinkIcon className="size-3" />
                          </a>
                        )}
                        <p className="text-muted-foreground">as of {plan.dataAsOf}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <p className="text-xs text-muted-foreground">
        {personalized
          ? "Premiums are for your age band, gender and smoker status. "
          : "Premiums shown are for a 30-year-old male non-smoker. "}
        Matching is a factual filter on your stated details, not a recommendation. Figures are
        indicative annual premiums from public brochures; confirm exact amounts with the insurer.
      </p>
    </div>
  );
}
