import { formatCurrency, formatDate } from "@/lib/utils";
import type { ExtractedQuote } from "@/lib/types";

interface Props {
  quote: ExtractedQuote;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <div className="text-sm text-gray-900 mt-0.5">{children}</div>
    </div>
  );
}

const PLACEHOLDER = <span className="text-gray-400">Not stated</span>;

export default function QuoteCard({ quote }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Extracted quote</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Annual premium">
          {quote.annualPremium !== undefined
            ? formatCurrency(quote.annualPremium)
            : PLACEHOLDER}
        </Field>

        <Field label="Coverage amount">
          {quote.coverageAmount !== undefined
            ? formatCurrency(quote.coverageAmount)
            : PLACEHOLDER}
        </Field>

        <Field label="Waiting period">
          {quote.waitingPeriod ? quote.waitingPeriod : PLACEHOLDER}
        </Field>

        <Field label="Valid until">
          {quote.validUntil ? formatDate(quote.validUntil) : PLACEHOLDER}
        </Field>
      </div>

      <Field label="Exclusions noted">
        {quote.exclusionsNoted && quote.exclusionsNoted.length > 0 ? (
          <ul className="list-disc pl-5 space-y-0.5">
            {quote.exclusionsNoted.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : (
          PLACEHOLDER
        )}
      </Field>

      <Field label="Rider options">
        {quote.riderOptions && quote.riderOptions.length > 0 ? (
          <ul className="list-disc pl-5 space-y-0.5">
            {quote.riderOptions.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : (
          PLACEHOLDER
        )}
      </Field>

      {quote.rawNotes && (
        <Field label="Notes">
          <p className="whitespace-pre-wrap text-gray-600">{quote.rawNotes}</p>
        </Field>
      )}

      <p className="text-xs text-gray-400">
        Extracted {formatDate(quote.extractedAt)}
      </p>
    </div>
  );
}
