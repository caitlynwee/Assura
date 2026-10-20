"use client";

import { ReceiptTextIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ExtractedQuote } from "@/lib/types";
import { useLocale, useT } from "@/lib/i18n/client";

interface Props {
  quote: ExtractedQuote;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

function Placeholder() {
  return <span className="text-muted-foreground">{useT().crm.notStated}</span>;
}

function List({ items }: { items?: string[] }) {
  return items && items.length > 0 ? (
    <ul className="list-disc space-y-0.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  ) : (
    <Placeholder />
  );
}

export default function QuoteCard({ quote }: Props) {
  const t = useT().crm.quote;
  const { intlLocale } = useLocale();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <ReceiptTextIcon className="size-4 text-primary" />
          {t.title}
        </CardTitle>
        <CardDescription>
          {t.parsedBy(formatDate(quote.extractedAt, intlLocale))}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.annualPremium}>
            {quote.annualPremium !== undefined ? (
              <span className="text-lg font-semibold tabular-nums">{formatCurrency(quote.annualPremium)}</span>
            ) : (
              <Placeholder />
            )}
          </Field>
          <Field label={t.coverageAmount}>
            {quote.coverageAmount !== undefined ? (
              <span className="text-lg font-semibold tabular-nums">{formatCurrency(quote.coverageAmount)}</span>
            ) : (
              <Placeholder />
            )}
          </Field>
          <Field label={t.waitingPeriod}>{quote.waitingPeriod ? quote.waitingPeriod : <Placeholder />}</Field>
          <Field label={t.validUntil}>{quote.validUntil ? formatDate(quote.validUntil, intlLocale) : <Placeholder />}</Field>
        </div>

        <Separator />

        <Field label={t.exclusions}>
          <List items={quote.exclusionsNoted} />
        </Field>
        <Field label={t.riders}>
          <List items={quote.riderOptions} />
        </Field>

        {quote.rawNotes && (
          <Field label={t.notes}>
            <p className="whitespace-pre-wrap text-muted-foreground">{quote.rawNotes}</p>
          </Field>
        )}
      </CardContent>
    </Card>
  );
}
