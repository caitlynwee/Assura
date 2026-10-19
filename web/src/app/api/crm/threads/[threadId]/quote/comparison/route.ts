import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertAllowed } from "@/lib/policy";
import { getThreadById, updateThread, getDb } from "@/lib/db";
import * as schema from "@/lib/schema";
import { logEvent } from "@/lib/audit";
import { generateId } from "@/lib/utils";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userTier = (session.user as any).tier;
  try {
    assertAllowed("update_thread_status", { userId, userTier });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403 });
  }

  const thread = await getThreadById(threadId, userId);
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  if (!thread.extractedQuote) {
    return NextResponse.json(
      { error: "Extract a quote before adding it to comparison" },
      { status: 400 }
    );
  }
  if (thread.addedToComparison) {
    return NextResponse.json({ error: "Quote is already in comparison" }, { status: 409 });
  }

  const quote = thread.extractedQuote;
  const now = new Date().toISOString();

  await getDb()
    .insert(schema.plans)
    .values({
      id: generateId("quote"),
      insurerId: thread.insurerId,
      insurerName: thread.insurerName,
      planName: `${thread.insurerName} — Personalised quote`,
      category: "critical_illness",
      coverageAmount: quote.coverageAmount ?? 0,
      premiums: quote.annualPremium ? { quoted_annual: quote.annualPremium } : {},
      premiumFrequency: "annual",
      coverageTerms: [],
      illnessesCovered: 0,
      earlyStageConditions: false,
      payoutType: "lump_sum",
      keyBenefits: quote.riderOptions ?? [],
      exclusions: quote.exclusionsNoted ?? [],
      sourceUrl: `crm://thread/${thread.id}`,
      dataAsOf: now.slice(0, 10),
      updatedBadge: true,
      changeNotes: ["Added from an insurer outreach quote."],
      version: 1,
      scrapedAt: now,
    });

  await updateThread(threadId, { addedToComparison: true, updatedAt: now });
  logEvent(userId, "quote.added_to_comparison", { threadId });

  return NextResponse.json({ thread: { ...thread, addedToComparison: true } });
}
