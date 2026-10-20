import "./setup";
import { NextRequest } from "next/server";
import { getPlans, getBrochureById } from "@/lib/db";

// ─── mock the session ─────────────────────────────────────────────────────────
// The admin routes call auth() from @/lib/auth. We drive the tier per-test to
// exercise the admin gate.
let currentSession: { user: { id: string; tier: string } } | null = null;

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(async () => currentSession),
}));

import { POST as createPlan } from "@/app/api/admin/plans/route";
import { POST as uploadBrochure } from "@/app/api/admin/plans/brochure/route";
import { GET as downloadBrochure } from "@/app/api/plans/brochure/[id]/route";

const ADMIN = { user: { id: "user_admin", tier: "admin" } };
const FREE = { user: { id: "user_free", tier: "free" } };

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function uploadRequest(file: File): NextRequest {
  const form = new FormData();
  form.append("file", file);
  // NextRequest accepts a FormData body; the boundary header is set for us.
  return new NextRequest("http://localhost/api/admin/plans/brochure", {
    method: "POST",
    body: form,
  });
}

const PDF_BYTES = Buffer.from("%PDF-1.4 fake brochure body", "utf-8");

describe("admin manual plan creation", () => {
  it("rejects a non-admin", async () => {
    currentSession = FREE;
    const res = await createPlan(
      jsonRequest("http://localhost/api/admin/plans", {
        insurerId: "aia",
        planName: "Blocked Plan",
        coverageAmount: 100000,
        premiumFrequency: "annual",
        illnessesCovered: 30,
        payoutType: "lump_sum",
      })
    );
    expect(res.status).toBe(403);
  });

  it("rejects an unknown insurer", async () => {
    currentSession = ADMIN;
    const res = await createPlan(
      jsonRequest("http://localhost/api/admin/plans", {
        insurerId: "does-not-exist",
        planName: "Orphan Plan",
        coverageAmount: 100000,
        premiumFrequency: "annual",
        illnessesCovered: 30,
        payoutType: "lump_sum",
      })
    );
    expect(res.status).toBe(400);
  });

  it("creates a plan that appears in the comparison for its country", async () => {
    currentSession = ADMIN;
    const res = await createPlan(
      jsonRequest("http://localhost/api/admin/plans", {
        insurerId: "aia",
        planName: "Manually Added CI Plan",
        coverageAmount: 150000,
        premiumFrequency: "annual",
        premiums: { male_30_nonsmoker: 1200 },
        coverageTerms: ["to_age_65"],
        illnessesCovered: 37,
        earlyStageConditions: true,
        payoutType: "lump_sum",
        keyBenefits: ["Multi-pay"],
        exclusions: ["Pre-existing conditions"],
        country: "Singapore",
      })
    );
    expect(res.status).toBe(201);
    const { planId } = (await res.json()) as { planId: string };
    expect(planId).toMatch(/^manual_/);

    const sgPlans = await getPlans("Singapore");
    const created = sgPlans.find((p) => p.id === planId);
    expect(created).toBeTruthy();
    expect(created?.planName).toBe("Manually Added CI Plan");
    expect(created?.insurerName).toBe("AIA Singapore");
    expect(created?.updatedBadge).toBe(true);
    expect(created?.version).toBe(1);
    expect(created?.premiums.male_30_nonsmoker).toBe(1200);
  });
});

describe("admin brochure upload + download", () => {
  it("rejects a non-admin upload", async () => {
    currentSession = FREE;
    const file = new File([new Uint8Array(PDF_BYTES)], "brochure.pdf", {
      type: "application/pdf",
    });
    const res = await uploadBrochure(uploadRequest(file));
    expect(res.status).toBe(403);
  });

  it("rejects an unsupported file type", async () => {
    currentSession = ADMIN;
    const file = new File([new Uint8Array(Buffer.from("echo hi"))], "evil.sh", {
      type: "application/x-sh",
    });
    const res = await uploadBrochure(uploadRequest(file));
    expect(res.status).toBe(415);
  });

  it("stores a PDF and serves it back to a signed-in user", async () => {
    currentSession = ADMIN;
    const file = new File([new Uint8Array(PDF_BYTES)], "ci-brochure.pdf", {
      type: "application/pdf",
    });
    const res = await uploadBrochure(uploadRequest(file));
    expect(res.status).toBe(201);
    const { brochureId, url } = (await res.json()) as { brochureId: string; url: string };
    expect(url).toBe(`/api/plans/brochure/${brochureId}`);

    // The bytes round-trip through the database unchanged.
    const stored = await getBrochureById(brochureId);
    expect(stored?.contentType).toBe("application/pdf");
    expect(stored?.data.equals(PDF_BYTES)).toBe(true);

    // A signed-in user can download it; the response streams the stored bytes.
    currentSession = FREE;
    const dl = await downloadBrochure(
      new NextRequest(`http://localhost${url}`),
      { params: Promise.resolve({ id: brochureId }) }
    );
    expect(dl.status).toBe(200);
    expect(dl.headers.get("Content-Type")).toBe("application/pdf");
    const body = Buffer.from(await dl.arrayBuffer());
    expect(body.equals(PDF_BYTES)).toBe(true);
  });

  it("returns 401 to an anonymous download and 404 for a missing brochure", async () => {
    currentSession = null;
    const anon = await downloadBrochure(
      new NextRequest("http://localhost/api/plans/brochure/whatever"),
      { params: Promise.resolve({ id: "whatever" }) }
    );
    expect(anon.status).toBe(401);

    currentSession = ADMIN;
    const missing = await downloadBrochure(
      new NextRequest("http://localhost/api/plans/brochure/missing"),
      { params: Promise.resolve({ id: "missing" }) }
    );
    expect(missing.status).toBe(404);
  });
});
