import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getScraperRuns } from "@/lib/db";

const SCRAPER_URL = process.env.SCRAPER_URL ?? "http://localhost:8100";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${SCRAPER_URL}/scraper/status`, {
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error("Scraper server returned " + res.status);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    // Fallback: read the latest run from the database.
    const runs = await getScraperRuns();
    const lastRun = runs.at(-1) ?? null;
    return NextResponse.json({ lastRun, scraperAvailable: false });
  }
}
