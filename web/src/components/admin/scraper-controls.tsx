"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale, useT } from "@/lib/i18n/client";

type ScraperRun = {
  runId: string;
  trigger: string;
  startedAt: string;
  finishedAt: string;
  sourcesChecked: number;
  sourcesChanged: number;
  errors: Array<{ sourceId?: string; message?: string }>;
};

type ScraperStatus = {
  last_run: ScraperRun | null;
  scraper_available: boolean;
  next_scheduled: string;
};

export default function ScraperControls() {
  const [status, setStatus] = useState<ScraperStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = useT().admin;
  const { locale, intlLocale } = useLocale();
  // Server error text is English; in Chinese show our own message.
  const msg = (code: string, fallback: string) => {
    const serverText = code.slice(code.indexOf(":") + 1);
    return locale === "en" && serverText ? serverText : fallback;
  };

  async function loadStatus() {
    const response = await fetch("/api/scraper/status", { cache: "no-store" });
    const data = (await response.json()) as ScraperStatus & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Unable to load scraper status.");
    setStatus(data);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStatus().catch((err: unknown) => {
        // Keep the server text only to show it in English; otherwise translate on render.
        setError(err instanceof Error && err.message ? `load:${err.message}` : "load:");
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function runScraper() {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/scraper/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to start rescrape.");
        await loadStatus();
      } catch (err: unknown) {
        setError(err instanceof Error && err.message ? `start:${err.message}` : "start:");
      }
    });
  }

  const lastRun = status?.last_run;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.refreshTitle}</CardTitle>
        <CardDescription>{t.refreshDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={runScraper} loading={pending}>
            {pending ? t.rescraping : t.rescrape}
          </Button>
          <span className="text-sm text-muted-foreground">
            {status?.scraper_available ? t.schedule(status.next_scheduled) : t.unavailable}
          </span>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {msg(error, error.startsWith("load:") ? t.loadFailed : t.startFailed)}
          </p>
        )}
        {lastRun ? (
          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium">{t.lastRun(new Date(lastRun.finishedAt).toLocaleString(intlLocale))}</p>
            <p className="text-muted-foreground">
              {t.runSummary(t.triggers[lastRun.trigger] ?? lastRun.trigger, lastRun.sourcesChecked, lastRun.sourcesChanged)}
            </p>
            {lastRun.errors.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-destructive">
                {lastRun.errors.map((item, index) => (
                  <li key={`${item.sourceId ?? "source"}-${index}`}>
                    {item.sourceId ?? t.source}: {item.message ?? t.unknownError}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t.noRuns}</p>
        )}
      </CardContent>
    </Card>
  );
}
