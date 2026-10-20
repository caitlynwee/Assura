import "./setup";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import * as schema from "@/lib/schema";
import { testDb } from "./setup";

let currentSession: { user: { id: string; tier: string } } | null = null;

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(async () => currentSession),
}));
jest.mock("@/lib/mail", () => ({
  generateMaskedAddress: jest.fn(() => "user-demo@relay.assura.local"),
  sendEmail: jest.fn(async (params: { to: string }) => ({
    messageId: "<test-message@assura.local>",
    from: "user-demo@relay.assura.local",
    to: params.to,
  })),
}));
jest.mock("@/lib/policy", () => ({
  assertAllowed: jest.fn(),
}));
jest.mock("@/lib/blocker", () => ({
  blockIfNeeded: jest.fn(),
}));

import { POST } from "@/app/api/outreach/send/route";
import { sendEmail } from "@/lib/mail";

describe("outreach send route", () => {
  beforeEach(async () => {
    await testDb
      .update(schema.insurers)
      .set({ agentEmail: "" })
      .where(eq(schema.insurers.id, "aia"));
    currentSession = { user: { id: "user_demo", tier: "premium" } };
    (sendEmail as jest.Mock).mockClear();
  });

  it("routes insurers with no configured contact to a local Mailpit demo address", async () => {
    const request = new NextRequest("http://localhost/api/outreach/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        insurerId: "aia",
        subject: "Critical illness plan question",
        body: "Could you share the coverage details?",
        userApproved: true,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "insurer-aia@insurer.assura.local",
      })
    );
  });
});
