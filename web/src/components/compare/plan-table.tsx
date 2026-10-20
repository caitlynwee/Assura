"use client";

import { ExternalLinkIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { usePlans, usePlanFilters } from "@/hooks/use-plans";
import { formatCurrency } from "@/lib/utils";
import {
  resolvePremium,
  isWithinBudget,
  meetsCoverageNeed,
  hasUsableProfile,
  type ComparePersonalProfile,
} from "@/lib/premium";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const COLUMNS = [
  { key: "plan", label: "Plan", className: "pl-4" },
  { key: "coverage", label: "Coverage", className: "text-right" },
  { key: "premium", label: "Premium", className: "text-right" },
  { key: "illnesses", label: "Illnesses", className: "text-center" },
  { key: "early", label: "Early stage", className: "text-center" },
  { key: "source", label: "Source", className: "pr-4" },
];

export default function PlanTable({ profile }: { profile?: ComparePersonalProfile }) {
  const { plans, loading, error } = usePlans();
  const { filters } = usePlanFilters();

  const personalized = hasUsableProfile(profile);
  const withinBudgetOnly = filters.withinBudgetOnly ?? false;
  const monthlyBudget = profile?.monthlyBudget;
  const coverageNeeded = profile?.coverageNeeded;

  // Premium column header reflects whether personalization is active.
  const premiumHeader = personalized ? "Premium (your profile)" : "Premium (M/30)";

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
      <Card className="gap-0 overflow-hidden py-0">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map((c) => (
                <TableHead
                  key={c.key}
                  className={`text-xs uppercase tracking-wide text-muted-foreground ${c.className}`}
                >
                  {c.key === "premium" ? premiumHeader : c.label}
                </TableHead>
              ))}
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
            ) : plans.filter((p) => p.coverageAmount > 0).length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLUMNS.length} className="py-12 text-center text-muted-foreground">
                  <SearchXIcon className="mx-auto mb-2 size-6" />
                  No plans match your filters.
                </TableCell>
              </TableRow>
            ) : (
              plans.filter((p) => p.coverageAmount > 0).map((plan) => {
                const resolved = resolvePremium(profile ?? {}, plan.premiums);
                const within = isWithinBudget(resolved.premium, monthlyBudget);
                const meetsCoverage = meetsCoverageNeed(plan.coverageAmount, coverageNeeded);
                // Emphasis-only: de-emphasize rows that are out of budget while the
                // toggle is on. Plans are never removed from the list.
                const deEmphasize = withinBudgetOnly && !within;

                return (
                  <TableRow key={plan.id} className={deEmphasize ? "opacity-50" : undefined}>
                    <TableCell className="py-3 pl-4">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{plan.planName}</p>
                        {plan.updatedBadge && <Badge variant="orange">Updated</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{plan.insurerName}</p>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      <div className="flex flex-col items-end gap-1">
                        <span>{formatCurrency(plan.coverageAmount)}</span>
                        {meetsCoverage && (
                          <Badge variant="blue" className="font-normal">
                            meets coverage need
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      <div className="flex flex-col items-end gap-1">
                        <span>
                          {resolved.premium !== undefined ? (
                            <>
                              {`${formatCurrency(resolved.premium)}/yr`}
                              {personalized && !resolved.isExactMatch && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help text-foreground"> *</span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    closest available: {resolved.matchedLabel}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </span>
                        {within && monthlyBudget !== undefined && (
                          <Badge variant="green" className="font-normal">
                            within budget
                          </Badge>
                        )}
                      </div>
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
                      <a
                        href={plan.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        Brochure
                        <ExternalLinkIcon className="size-3" />
                      </a>
                      <p className="text-muted-foreground">as of {plan.dataAsOf}</p>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {!loading && !personalized && (
        <Alert>
          <AlertDescription>
            Showing default premiums for a 30-year-old non-smoker (M/30).{" "}
            <Link href="/onboarding" className="font-medium text-primary hover:underline">
              Add your details
            </Link>{" "}
            for premiums tailored to you.
          </AlertDescription>
        </Alert>
      )}

      <p className="text-xs text-muted-foreground">
        {personalized
          ? "Premiums shown are for your profile’s bucket. "
          : ""}
        Figures are indicative annual premiums sourced from public brochures; confirm exact
        amounts with the insurer.
      </p>
    </div>
  );
}
