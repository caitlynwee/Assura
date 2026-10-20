"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

type State = "idle" | "running" | "done" | "error";

export default function RunScraperButton() {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string>("");
  const t = useT().compare.scraper;

  async function handleRun() {
    setState("running");
    setMessage("");
    try {
      const res = await fetch("/api/scraper/trigger", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setMessage(
          data.error === "Scraper server unavailable" ? t.unavailable : (data.error ?? t.failed)
        );
      } else {
        setState("done");
        setMessage(t.done(data.sourcesChanged ?? 0));
      }
    } catch {
      setState("error");
      setMessage(t.unreachable);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <button
        onClick={handleRun}
        disabled={state === "running"}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {state === "running" ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {t.scraping}
          </>
        ) : (
          <>
            <span>⟳</span>
            {t.refresh}
          </>
        )}
      </button>
      {message && (
        <p className={`text-xs ${state === "error" ? "text-red-500" : "text-gray-500"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
