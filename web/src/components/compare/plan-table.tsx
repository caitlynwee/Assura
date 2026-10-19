"use client";

import { ExternalLinkIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react";
import { usePlans } from "@/hooks/use-plans";
import { formatCurrency } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const COLUMNS = [
  { label: "Plan", className: "pl-4" },
  { label: "Coverage", className: "text-right" },
  { label: "Premium (M/30)", className: "text-right" },
  { label: "Illnesses", className: "text-center" },
  { label: "Early stage", className: "text-center" },
  { label: "Source", className: "pr-4" },
];

export default function PlanTable() {
  const { plans, loading, error } = usePlans();

  if (error) {
    return (
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            {COLUMNS.map((c) => (
              <TableHead
                key={c.label}
                className={`text-xs uppercase tracking-wide text-muted-foreground ${c.className}`}
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {COLUMNS.map((c) => (
                  <TableCell key={c.label} className="py-4">
                    <Skeleton className="h-4 w-full max-w-28" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : plans.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={COLUMNS.length} className="py-12 text-center text-muted-foreground">
                <SearchXIcon className="mx-auto mb-2 size-6" />
                No plans match your filters.
              </TableCell>
            </TableRow>
          ) : (
            plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="py-3 pl-4">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{plan.planName}</p>
                    {plan.updatedBadge && <Badge variant="orange">Updated</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{plan.insurerName}</p>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrency(plan.coverageAmount)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {plan.premiums.male_30_nonsmoker
                    ? `${formatCurrency(plan.premiums.male_30_nonsmoker)}/yr`
                    : "—"}
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
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
