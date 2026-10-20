"use client";

import { useState } from "react";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshPlans } from "@/hooks/use-plans";

/**
 * Refresh button for the Compare page. Re-fetches the latest plans FROM THE
 * DATABASE — it does NOT trigger a scrape. Running the scraper against insurer
 * sites is an admin-only operation on the Admin page (ScraperControls).
 */
export default function RefreshPlansButton() {
  const [spinning, setSpinning] = useState(false);

  function handleRefresh() {
    setSpinning(true);
    refreshPlans();
    // Brief spin for feedback; the table shows its own loading state.
    window.setTimeout(() => setSpinning(false), 600);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleRefresh} className="shrink-0">
      <RefreshCwIcon className={spinning ? "animate-spin" : undefined} />
      Refresh
    </Button>
  );
}
