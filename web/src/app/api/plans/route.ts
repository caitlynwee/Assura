import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlans } from "@/lib/db";
import { planFilterSchema } from "@/lib/validators";
import { evaluateAction } from "@/lib/policy";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const decision = evaluateAction("read_plans", {
    userId: session.user.id!,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userTier: (session.user as any).tier,
  });
  if (decision.outcome !== "allow") {
    return NextResponse.json({ error: decision.reason }, { status: 403 });
  }

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = planFilterSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid filters" }, { status: 400 });
  }

  const country = req.nextUrl.searchParams.get("country") ?? process.env.CURRENT_COUNTRY ?? "Singapore";
  let plans = await getPlans(country);
  const { insurerId, minCoverage, maxCoverage, earlyStage, sortBy, sortDir, search } =
    parsed.data;

  if (insurerId) plans = plans.filter((p) => p.insurerId === insurerId);
  if (minCoverage) plans = plans.filter((p) => p.coverageAmount >= minCoverage);
  if (maxCoverage) plans = plans.filter((p) => p.coverageAmount <= maxCoverage);
  if (earlyStage !== undefined)
    plans = plans.filter((p) => p.earlyStageConditions === (earlyStage === "true"));
  if (search) {
    const q = search.toLowerCase();
    plans = plans.filter(
      (p) =>
        p.planName.toLowerCase().includes(q) ||
        p.insurerName.toLowerCase().includes(q)
    );
  }

  if (sortBy) {
    plans.sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      if (sortBy === "planName") { va = a.planName; vb = b.planName; }
      else if (sortBy === "coverageAmount") { va = a.coverageAmount; vb = b.coverageAmount; }
      else if (sortBy === "illnessesCovered") { va = a.illnessesCovered; vb = b.illnessesCovered; }
      else if (sortBy === "premiums") {
        va = a.premiums.male_30_nonsmoker ?? 0;
        vb = b.premiums.male_30_nonsmoker ?? 0;
      }
      if (va < vb) return sortDir === "desc" ? 1 : -1;
      if (va > vb) return sortDir === "desc" ? -1 : 1;
      return 0;
    });
  }

  return NextResponse.json({ plans });
}
