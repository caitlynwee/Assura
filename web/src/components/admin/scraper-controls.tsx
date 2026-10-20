"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

  async function loadStatus() {
    const response = await fetch("/api/scraper/status", { cache: "no-store" });
    const data = (await response.json()) as ScraperStatus & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Unable to load scraper status.");
    setStatus(data);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStatus().catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unable to load scraper status.");
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
        setError(err instanceof Error ? err.message : "Unable to start rescrape.");
      }
    });
  }

  const lastRun = status?.last_run;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Insurance data refresh</CardTitle>
        <CardDescription>
          Run the scraper against all configured insurer websites. This may take several minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={runScraper} loading={pending}>
            {pending ? "Rescraping…" : "Rescrape all insurers"}
          </Button>
          <span className="text-sm text-muted-foreground">
            {status?.scraper_available ? `Automatic schedule: ${status.next_scheduled}` : "Scraper unavailable"}
          </span>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {lastRun ? (
          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium">Last run: {new Date(lastRun.finishedAt).toLocaleString()}</p>
            <p className="text-muted-foreground">
              {lastRun.trigger} · checked {lastRun.sourcesChecked} · changed {lastRun.sourcesChanged}
            </p>
            {lastRun.errors.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-destructive">
                {lastRun.errors.map((item, index) => (
                  <li key={`${item.sourceId ?? "source"}-${index}`}>
                    {item.sourceId ?? "source"}: {item.message ?? "Unknown error"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No scraper runs recorded yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
