"use client";

import { useState } from "react";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";
import ThreadTimeline from "@/components/crm/thread-timeline";
import QuoteCard from "@/components/crm/quote-card";
import { useThread } from "@/hooks/use-thread";
import type { ExtractedQuote } from "@/lib/types";

const STATUS_VARIANTS: Record<
  string,
  "blue" | "green" | "yellow" | "red" | "orange" | "gray" | "purple"
> = {
  draft: "gray",
  awaiting_approval: "yellow",
  sent: "blue",
  replied: "purple",
  info_received: "green",
  flagged: "red",
  closed: "gray",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  awaiting_approval: "Awaiting Approval",
  sent: "Sent",
  replied: "Replied",
  info_received: "Info Received",
  flagged: "Flagged",
  closed: "Closed",
};

const RISK_FLAG_LABELS: Record<string, string> = {
  pushy: "Pushy sales tactics",
  data_grabber: "Excessive personal-data requests",
  injector: "Prompt-injection attempt in reply",
};

interface Props {
  threadId: string;
}

export default function ThreadDetail({ threadId }: Props) {
  const { thread, loading, error, setThread } = useThread(threadId);

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [quote, setQuote] = useState<ExtractedQuote | null>(null);

  async function handleExtractQuote() {
    setExtracting(true);
    setExtractError(null);
    try {
      const res = await fetch(`/api/crm/threads/${threadId}/quote`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setExtractError(data.error ?? "Could not extract a quote. Please try again.");
        return;
      }
      const data = await res.json();
      const extracted: ExtractedQuote | null = data.quote ?? null;
      setQuote(extracted);
      // Reflect the server-side status change (-> info_received) in the UI.
      if (thread) {
        setThread({
          ...thread,
          extractedQuote: extracted,
          status: "info_received",
        });
      }
    } catch {
      setExtractError("Could not extract a quote. Please try again.");
    } finally {
      setExtracting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <p className="text-red-600 text-sm">{error}</p>;
  }

  if (!thread) {
    return (
      <div className="bg-white border rounded-xl p-6 text-sm text-gray-400">
        Thread not found.
      </div>
    );
  }

  const displayedQuote = quote ?? thread.extractedQuote;

  return (
    <div className="space-y-6">
      {/* Header: insurer, subject, status */}
      <div className="bg-white border rounded-xl p-6 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-900">
            {thread.insurerName}
          </h2>
          <Badge variant={STATUS_VARIANTS[thread.status] ?? "gray"}>
            {STATUS_LABELS[thread.status] ?? thread.status}
          </Badge>
        </div>
        <p className="text-sm text-gray-500">{thread.subject}</p>
      </div>

      {/* Prominent risk flags */}
      {thread.riskFlags.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <Badge variant="red">⚠ Risk flags</Badge>
            <p className="text-sm font-semibold text-red-800">
              This thread was flagged for review
            </p>
          </div>
          <ul className="mt-2 list-disc pl-5 space-y-0.5 text-sm text-red-700">
            {thread.riskFlags.map((flag) => (
              <li key={flag}>{RISK_FLAG_LABELS[flag] ?? flag}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Message timeline */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Messages</h2>
        <ThreadTimeline messages={thread.messages} />
      </section>

      {/* Quote extraction */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-900">Quote</h2>
          <Button
            variant="secondary"
            size="sm"
            loading={extracting}
            onClick={handleExtractQuote}
          >
            Extract quote
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          Inbound insurer text is parsed through the quarantined reader, so any
          injected &ldquo;ignore previous instructions&rdquo; content is treated
          as data only — this view simply displays the extracted fields.
        </p>
        {extractError && <p className="text-red-600 text-sm">{extractError}</p>}
        {displayedQuote && <QuoteCard quote={displayedQuote} />}
      </section>
    </div>
  );
}
