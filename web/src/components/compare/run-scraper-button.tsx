"use client";

import { useState } from "react";

type State = "idle" | "running" | "done" | "error";

export default function RunScraperButton() {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string>("");

  async function handleRun() {
    setState("running");
    setMessage("");
    try {
      const res = await fetch("/api/scraper/trigger", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setMessage(data.error ?? "Scraper failed");
      } else {
        setState("done");
        setMessage(
          `Done — ${data.sourcesChanged ?? 0} source(s) updated. Refresh to see new plans.`
        );
      }
    } catch {
      setState("error");
      setMessage("Could not reach scraper server.");
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
            Scraping…
          </>
        ) : (
          <>
            <span>⟳</span>
            Refresh data
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
