"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  BotIcon,
  CheckIcon,
  ClockIcon,
  FlagIcon,
  ListPlusIcon,
  ShieldAlertIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import Spinner from "@/components/ui/spinner";
import ThreadTimeline from "@/components/crm/thread-timeline";
import QuoteCard from "@/components/crm/quote-card";
import { STATUS_LABELS, STATUS_VARIANTS } from "@/components/crm/thread-card";
import { useThread } from "@/hooks/use-thread";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ExtractedQuote } from "@/lib/types";

function QuoteReviewRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value ?? <span className="text-muted-foreground">Not stated</span>}</dd>
    </div>
  );
}

const RISK_FLAG_LABELS: Record<string, string> = {
  pushy: "Pushy sales tactics",
  data_grabber: "Excessive personal-data requests",
  injector: "Prompt-injection attempt in reply",
};

interface Props {
  threadId: string;
}

function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export default function ThreadDetail({ threadId }: Props) {
  const { thread, loading, error, polling, setThread, pollUntilChanged } =
    useThread(threadId);

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [quote, setQuote] = useState<ExtractedQuote | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simulateError, setSimulateError] = useState<string | null>(null);
  const [simulateNotice, setSimulateNotice] = useState<string | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [confirmingComparison, setConfirmingComparison] = useState(false);
  const [addingToComparison, setAddingToComparison] = useState(false);
  const [statusAction, setStatusAction] = useState<"closed" | "flagged" | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

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

  async function handleSimulateReply() {
    setSimulating(true);
    setSimulateError(null);
    setSimulateNotice(null);
    try {
      const res = await fetch(`/api/crm/threads/${threadId}/reply`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSimulateError(data.error ?? "Could not simulate an insurer reply.");
        return;
      }
      // The reply may land server-side asynchronously (and the 'slow' persona
      // only replies after a follow-up), so poll a few times and stop early
      // once the thread's status or message count changes.
      const changed = await pollUntilChanged();
      if (!changed) {
        setSimulateNotice(
          "No reply has arrived yet. This insurer's persona may only respond to a follow-up — try again shortly."
        );
      }
    } catch {
      setSimulateError("Could not simulate an insurer reply.");
    } finally {
      setSimulating(false);
    }
  }

  async function updateStatus(status: "closed" | "flagged") {
    setStatusAction(status);
    setStatusError(null);
    try {
      const res = await fetch(`/api/crm/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.thread) {
        setStatusError(
          data.error ??
            (status === "closed"
              ? "Could not close the thread. Please try again."
              : "Could not flag the thread for review. Please try again.")
        );
        return;
      }
      // Only reflect the new status once the server confirmed it.
      setThread(data.thread);
    } catch {
      setStatusError(
        status === "closed"
          ? "Could not close the thread. Please try again."
          : "Could not flag the thread for review. Please try again."
      );
    } finally {
      setStatusAction(null);
    }
  }

  async function confirmAddToComparison() {
    setComparisonError(null);
    setAddingToComparison(true);
    try {
      const res = await fetch(`/api/crm/threads/${threadId}/quote/comparison`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setComparisonError(data.error ?? "Could not add quote to comparison.");
        return;
      }
      if (data.thread) setThread(data.thread);
      setConfirmingComparison(false);
    } catch {
      setComparisonError("Could not add quote to comparison.");
    } finally {
      setAddingToComparison(false);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]" aria-busy="true">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error) return <InlineError message={error} />;

  if (!thread) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">Thread not found.</CardContent>
      </Card>
    );
  }

  const displayedQuote = quote ?? thread.extractedQuote;
  const closed = thread.status === "closed";

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/crm">
          <ArrowLeftIcon />
          All threads
        </Link>
      </Button>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left: header + timeline */}
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                {thread.insurerName}
                <Badge variant={STATUS_VARIANTS[thread.status] ?? "gray"}>
                  {STATUS_LABELS[thread.status] ?? thread.status}
                </Badge>
              </CardTitle>
              <CardDescription>{thread.subject}</CardDescription>
            </CardHeader>
          </Card>

          {thread.riskFlags.length > 0 && (
            <Alert variant="destructive">
              <ShieldAlertIcon />
              <AlertTitle>This thread was flagged for review</AlertTitle>
              <AlertDescription>
                <ul className="list-disc space-y-0.5 pl-5">
                  {thread.riskFlags.map((flag) => (
                    <li key={flag}>{RISK_FLAG_LABELS[flag] ?? flag}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Messages</h2>
            <ThreadTimeline messages={thread.messages} />
          </section>
        </div>

        {/* Right: actions + quote */}
        <div className="space-y-6 lg:sticky lg:top-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  loading={simulating}
                  onClick={handleSimulateReply}
                  disabled={closed}
                >
                  {!simulating && <BotIcon />}
                  Simulate insurer reply
                </Button>
                <p className="text-xs text-muted-foreground">
                  Demo only: runs this insurer&apos;s configured persona through the outreach server.
                </p>
                {polling && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
                    <Spinner className="size-3.5" /> Checking for a reply…
                  </p>
                )}
                {simulateNotice && (
                  <Alert variant="warning">
                    <ClockIcon />
                    <AlertDescription>{simulateNotice}</AlertDescription>
                  </Alert>
                )}
                <InlineError message={simulateError} />
              </div>

              <Separator />

              <div className="flex flex-wrap gap-2">
                {!closed && (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={statusAction === "closed"}
                    disabled={statusAction !== null}
                    onClick={() => updateStatus("closed")}
                  >
                    {statusAction !== "closed" && <ArchiveIcon />}
                    Close thread
                  </Button>
                )}
                {thread.status !== "flagged" && thread.riskFlags.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={statusAction === "flagged"}
                    disabled={statusAction !== null}
                    onClick={() => updateStatus("flagged")}
                  >
                    {statusAction !== "flagged" && <FlagIcon />}
                    Flag for review
                  </Button>
                )}
              </div>
              <InlineError message={statusError} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quote</CardTitle>
              <CardDescription className="text-xs">
                Insurer replies are parsed by the quarantined reader, so injected &ldquo;ignore previous
                instructions&rdquo; text is treated as data only.
              </CardDescription>
              <CardAction>
                <Button size="sm" loading={extracting} onClick={handleExtractQuote}>
                  {!extracting && <SparklesIcon />}
                  Extract
                </Button>
              </CardAction>
            </CardHeader>
            {(extractError || displayedQuote) && (
              <CardContent className="space-y-3">
                <InlineError message={extractError} />

                {displayedQuote && !confirmingComparison && (
                  <>
                    <Button
                      variant={thread.addedToComparison ? "secondary" : "outline"}
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setComparisonError(null);
                        setConfirmingComparison(true);
                      }}
                      disabled={thread.addedToComparison}
                    >
                      {thread.addedToComparison ? <CheckIcon /> : <ListPlusIcon />}
                      {thread.addedToComparison ? "Added to comparison" : "Add to comparison"}
                    </Button>
                    <InlineError message={comparisonError} />
                  </>
                )}

                {/* Review gate: show the extracted fields and require an explicit confirm
                    before committing the quote to the comparison table. */}
                {displayedQuote && confirmingComparison && (
                  <div className="space-y-3 rounded-lg border bg-muted/50 p-3">
                    <div>
                      <p className="text-sm font-semibold">Review before adding to your comparison</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        These figures were extracted from the insurer&apos;s reply. Confirm they look right —
                        this adds a factual row to your comparison table and is not a recommendation.
                      </p>
                    </div>
                    <dl className="grid gap-x-4 gap-y-2 text-sm">
                      <QuoteReviewRow
                        label="Coverage amount"
                        value={
                          displayedQuote.coverageAmount !== undefined
                            ? formatCurrency(displayedQuote.coverageAmount)
                            : null
                        }
                      />
                      <QuoteReviewRow
                        label="Annual premium"
                        value={
                          displayedQuote.annualPremium !== undefined
                            ? formatCurrency(displayedQuote.annualPremium)
                            : null
                        }
                      />
                      <QuoteReviewRow label="Waiting period" value={displayedQuote.waitingPeriod ?? null} />
                      <QuoteReviewRow
                        label="Valid until"
                        value={displayedQuote.validUntil ? formatDate(displayedQuote.validUntil) : null}
                      />
                      <QuoteReviewRow
                        label="Exclusions noted"
                        value={
                          displayedQuote.exclusionsNoted && displayedQuote.exclusionsNoted.length > 0
                            ? displayedQuote.exclusionsNoted.join("; ")
                            : null
                        }
                      />
                      <QuoteReviewRow
                        label="Rider options"
                        value={
                          displayedQuote.riderOptions && displayedQuote.riderOptions.length > 0
                            ? displayedQuote.riderOptions.join("; ")
                            : null
                        }
                      />
                    </dl>
                    <div className="flex items-center gap-2 pt-1">
                      <Button size="sm" loading={addingToComparison} onClick={confirmAddToComparison}>
                        {!addingToComparison && <CheckIcon />}
                        Confirm &amp; add
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={addingToComparison}
                        onClick={() => {
                          setConfirmingComparison(false);
                          setComparisonError(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                    <InlineError message={comparisonError} />
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {displayedQuote && <QuoteCard quote={displayedQuote} />}
        </div>
      </div>
    </div>
  );
}