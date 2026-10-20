"use client";

import { ScrollTextIcon, TriangleAlertIcon } from "lucide-react";
import { useAuditLog } from "@/hooks/use-audit-log";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLocale, useT } from "@/lib/i18n/client";

/** Colour-code actions so blocks, denials and escalations stand out in the demo. */
function actionVariant(action: string): "red" | "yellow" | "green" | "blue" | "gray" {
  if (/block|deny|locked|failed|flag|tamper/.test(action)) return "red";
  if (/escalate/.test(action)) return "yellow";
  if (/sent|allow|success|onboard|verify/.test(action)) return "green";
  if (/^auth|^user/.test(action)) return "blue";
  return "gray";
}

function formatTime(iso: string, intlLocale: string) {
  return new Date(iso).toLocaleString(intlLocale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AuditEventList() {
  const { entries, loading, error } = useAuditLog();
  const t = useT().activity;
  const { intlLocale } = useLocale();

  if (loading) {
    return <Skeleton className="h-64 w-full rounded-xl" aria-busy="true" />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertDescription>{t.loadFailed}</AlertDescription>
      </Alert>
    );
  }

  if (!entries.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
          <ScrollTextIcon className="size-8" />
          {t.empty}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            {t.columns.map((h, i) => (
              <TableHead
                key={h}
                className={`text-xs uppercase tracking-wide text-muted-foreground ${i === 0 ? "pl-4" : ""}`}
              >
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry, i) => (
            <TableRow key={i}>
              <TableCell className="pl-4 text-xs tabular-nums text-muted-foreground">
                {formatTime(entry.timestamp, intlLocale)}
              </TableCell>
              <TableCell className="font-mono text-xs">{entry.actor.slice(0, 14)}</TableCell>
              <TableCell>
                <Badge variant={actionVariant(entry.action)} className="font-mono font-normal">
                  {entry.action}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {entry.prevHash.slice(0, 8)}…
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{entry.hash.slice(0, 8)}…</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
