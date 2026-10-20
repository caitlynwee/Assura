import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertAllowed } from "@/lib/policy";
import { planCreateSchema } from "@/lib/validators";
import { getInsurerById, insertPlan } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { generateId } from "@/lib/utils";

/**
 * POST /api/admin/plans — manually add a critical-illness plan.
 *
 * A fallback for when the scraper can't publish a plan: an admin enters the
 * brochure data by hand and it immediately appears in the comparison table for
 * users whose country matches the plan's `country`.
 *
 * Admin-only (tier check + policy SEND gate). The write only ADDS a row, never
 * deletes, so it can't clobber scraper-maintained data. Audit-logged with the
 * new plan id (never bypassing the hash chain).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const userTier = session.user.tier;

  try {
    if (userTier !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    assertAllowed("create_plan", { userId, userTier, userApproved: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = planCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "Invalid plan", field: first?.path?.[0] },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // insurerId is a FK → the insurer must already exist. Insurers are created by
  // the scraper/seed, not here, so reject an unknown insurer with a clear message.
  const insurer = await getInsurerById(input.insurerId);
  if (!insurer) {
    return NextResponse.json(
      { error: "Unknown insurer. Pick one of the configured insurers." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const id = generateId("manual");

  await insertPlan({
    id,
    insurerId: insurer.id,
    insurerName: insurer.name,
    planName: input.planName,
    category: "critical_illness",
    coverageAmount: input.coverageAmount,
    premiums: input.premiums,
    premiumFrequency: input.premiumFrequency,
    coverageTerms: input.coverageTerms,
    illnessesCovered: input.illnessesCovered,
    earlyStageConditions: input.earlyStageConditions,
    payoutType: input.payoutType,
    keyBenefits: input.keyBenefits,
    exclusions: input.exclusions,
    sourceUrl: input.sourceUrl,
    productUrl: input.productUrl,
    dataAsOf: input.dataAsOf ?? now.slice(0, 10),
    updatedBadge: true,
    changeNotes: [`Added manually by admin on ${now.slice(0, 10)}.`],
    version: 1,
    scrapedAt: now,
    country: input.country,
  });

  await logEvent(userId, "plan.created_manually", {
    planId: id,
    insurerId: insurer.id,
    planName: input.planName,
    country: input.country,
  });

  return NextResponse.json({ ok: true, planId: id }, { status: 201 });
}
