import { ReceiptTextIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ExtractedQuote } from "@/lib/types";

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

const PLACEHOLDER = <span className="text-muted-foreground">Not stated</span>;

function List({ items }: { items?: string[] }) {
  return items && items.length > 0 ? (
    <ul className="list-disc space-y-0.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  ) : (
    PLACEHOLDER
  );
}

export default function QuoteCard({ quote }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <ReceiptTextIcon className="size-4 text-primary" />
          Extracted quote
        </CardTitle>
        <CardDescription>
          Parsed by the quarantined reader · {formatDate(quote.extractedAt)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Annual premium">
            {quote.annualPremium !== undefined ? (
              <span className="text-lg font-semibold tabular-nums">{formatCurrency(quote.annualPremium)}</span>
            ) : (
              PLACEHOLDER
            )}
          </Field>
          <Field label="Coverage amount">
            {quote.coverageAmount !== undefined ? (
              <span className="text-lg font-semibold tabular-nums">{formatCurrency(quote.coverageAmount)}</span>
            ) : (
              PLACEHOLDER
            )}
          </Field>
          <Field label="Waiting period">{quote.waitingPeriod ? quote.waitingPeriod : PLACEHOLDER}</Field>
          <Field label="Valid until">{quote.validUntil ? formatDate(quote.validUntil) : PLACEHOLDER}</Field>
        </div>

        <Separator />

        <Field label="Exclusions noted">
          <List items={quote.exclusionsNoted} />
        </Field>
        <Field label="Rider options">
          <List items={quote.riderOptions} />
        </Field>

        {quote.rawNotes && (
          <Field label="Notes">
            <p className="whitespace-pre-wrap text-muted-foreground">{quote.rawNotes}</p>
          </Field>
        )}
      </CardContent>
    </Card>
  );
}
