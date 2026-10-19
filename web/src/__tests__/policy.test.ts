import "./setup";
import { evaluateAction } from "@/lib/policy";

describe("Policy engine", () => {
  const premiumCtx = { userId: "user_demo", userTier: "premium" as const };
  const freeCtx = { userId: "user_demo", userTier: "free" as const };

  it("allows read_plans for all tiers", () => {
    expect(evaluateAction("read_plans", freeCtx).outcome).toBe("allow");
    expect(evaluateAction("read_plans", premiumCtx).outcome).toBe("allow");
  });

  it("allows draft_email only for premium", () => {
    expect(evaluateAction("draft_email", freeCtx).outcome).toBe("deny");
    expect(evaluateAction("draft_email", premiumCtx).outcome).toBe("allow");
  });

  it("allows send_email only with userApproved=true", () => {
    expect(evaluateAction("send_email", premiumCtx).outcome).toBe("deny");
    expect(evaluateAction("send_email", { ...premiumCtx, userApproved: true }).outcome).toBe("allow");
  });

  it("escalates blocked actions (share_nric, share_health)", () => {
    expect(evaluateAction("share_nric", premiumCtx).outcome).toBe("escalate");
    expect(evaluateAction("share_health", premiumCtx).outcome).toBe("escalate");
    expect(evaluateAction("agree_to_buy", premiumCtx).outcome).toBe("escalate");
    expect(evaluateAction("book_call", premiumCtx).outcome).toBe("escalate");
  });
});
