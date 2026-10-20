"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  CheckIcon,
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
import { STATUS_VARIANTS } from "@/components/crm/thread-card";
import { useLocale, useT } from "@/lib/i18n/client";
import { useThread } from "@/hooks/use-thread";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ExtractedQuote } from "@/lib/types";

function QuoteReviewRow({ label, value }: { label: string; value: string | null }) {
  const notStated = useT().crm.notStated;
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value ?? <span className="text-muted-foreground">{notStated}</span>}</dd>
    </div>
  );
}

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
  const { thread, loading, error, polling, setThread, refresh, pollUntilChanged } =
    useThread(threadId);

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [quote, setQuote] = useState<ExtractedQuote | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [confirmingComparison, setConfirmingComparison] = useState(false);
  const [addingToComparison, setAddingToComparison] = useState(false);
  const [statusAction, setStatusAction] = useState<"closed" | "flagged" | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const tt = useT();
  const t = tt.crm.detail;
  const q = tt.crm.quote;
  const { locale, intlLocale } = useLocale();
  // Server error text is English; in Chinese show our own translated message.
  const serverText = (msg: unknown): string | undefined =>
    locale === "en" && typeof msg === "string" ? msg : undefined;

  async function handleExtractQuote() {
    setExtracting(true);
    setExtractError(null);
    try {
      const res = await fetch(`/api/crm/threads/${threadId}/quote`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setExtractError(serverText(data.error) ?? t.extractFailed);
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
      setExtractError(t.extractFailed);
    } finally {
      setExtracting(false);
    }
  }

  // Replies now arrive asynchronously from the background mail listener (an
  // immediate "ticketed" ack, then a delayed persona answer). Poll the thread
  // while it is open so the ack and answer appear without a manual refresh:
  // once after initial load to catch the imminent ack, then periodically.
  const threadClosed = thread?.status === "closed";
  useEffect(() => {
    if (loading || threadClosed) return;
    let cancelled = false;
    // Catch the imminent ack right after load.
    void pollUntilChanged();
    const interval = setInterval(() => {
      if (!cancelled) void refresh();
    }, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [loading, threadClosed, pollUntilChanged, refresh]);

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
          serverText(data.error) ?? (status === "closed" ? t.closeFailed : t.flagFailed)
        );
        return;
      }
      // Only reflect the new status once the server confirmed it.
      setThread(data.thread);
    } catch {
      setStatusError(
        status === "closed" ? t.closeFailed : t.flagFailed
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
        setComparisonError(serverText(data.error) ?? t.addFailed);
        return;
      }
      if (data.thread) setThread(data.thread);
      setConfirmingComparison(false);
    } catch {
      setComparisonError(t.addFailed);
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

  if (error) return <InlineError message={tt.crm.loadThreadFailed} />;

  if (!thread) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">{t.notFound}</CardContent>
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
          {t.allThreads}
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
                  {tt.crm.status[thread.status] ?? thread.status}
                </Badge>
              </CardTitle>
              <CardDescription>{thread.subject}</CardDescription>
            </CardHeader>
          </Card>

          {thread.riskFlags.length > 0 && (
            <Alert variant="destructive">
              <ShieldAlertIcon />
              <AlertTitle>{t.flaggedTitle}</AlertTitle>
              <AlertDescription>
                <ul className="list-disc space-y-0.5 pl-5">
                  {thread.riskFlags.map((flag) => (
                    <li key={flag}>{tt.crm.riskFlags[flag] ?? flag}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">{t.messages}</h2>
            <ThreadTimeline messages={thread.messages} />
          </section>
        </div>

        {/* Right: actions + quote */}
        <div className="space-y-6 lg:sticky lg:top-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t.actions}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Insurer replies arrive automatically in the sandbox: an immediate
                  acknowledgement, then this insurer&apos;s persona answer a few seconds later.
                  This thread refreshes on its own as they land.
                </p>
                {polling && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
                    <Spinner className="size-3.5" /> {t.checking}
                  </p>
                )}
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
                    {t.closeThread}
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
                    {t.flagForReview}
                  </Button>
                )}
              </div>
              <InlineError message={statusError} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t.quoteTitle}</CardTitle>
              <CardDescription className="text-xs">
                {t.quoteDesc}
              </CardDescription>
              <CardAction>
                <Button size="sm" loading={extracting} onClick={handleExtractQuote}>
                  {!extracting && <SparklesIcon />}
                  {t.extract}
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
                      {thread.addedToComparison ? t.addedToComparison : t.addToComparison}
                    </Button>
                    <InlineError message={comparisonError} />
                  </>
                )}

                {/* Review gate: show the extracted fields and require an explicit confirm
                    before committing the quote to the comparison table. */}
                {displayedQuote && confirmingComparison && (
                  <div className="space-y-3 rounded-lg border bg-muted/50 p-3">
                    <div>
                      <p className="text-sm font-semibold">{t.reviewTitle}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t.reviewBody}
                      </p>
                    </div>
                    <dl className="grid gap-x-4 gap-y-2 text-sm">
                      <QuoteReviewRow
                        label={q.coverageAmount}
                        value={
                          displayedQuote.coverageAmount !== undefined
                            ? formatCurrency(displayedQuote.coverageAmount)
                            : null
                        }
                      />
                      <QuoteReviewRow
                        label={q.annualPremium}
                        value={
                          displayedQuote.annualPremium !== undefined
                            ? formatCurrency(displayedQuote.annualPremium)
                            : null
                        }
                      />
                      <QuoteReviewRow label={q.waitingPeriod} value={displayedQuote.waitingPeriod ?? null} />
                      <QuoteReviewRow
                        label={q.validUntil}
                        value={displayedQuote.validUntil ? formatDate(displayedQuote.validUntil, intlLocale) : null}
                      />
                      <QuoteReviewRow
                        label={q.exclusions}
                        value={
                          displayedQuote.exclusionsNoted && displayedQuote.exclusionsNoted.length > 0
                            ? displayedQuote.exclusionsNoted.join("; ")
                            : null
                        }
                      />
                      <QuoteReviewRow
                        label={q.riders}
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
                        {t.confirmAdd}
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
                        {tt.common.cancel}
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