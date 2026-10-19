"use client";

import { useState } from "react";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";

type VerifyState = "idle" | "loading" | "valid" | "invalid";

export default function VerifyChainButton() {
  const [state, setState] = useState<VerifyState>("idle");
  const [detail, setDetail] = useState<string>("");

  async function handleVerify() {
    setState("loading");
    try {
      const res = await fetch("/api/audit/verify", { method: "POST" });
      const data = await res.json();
      if (data.valid) {
        setState("valid");
        setDetail(`${data.entries} entries verified.`);
      } else {
        setState("invalid");
        setDetail(`Chain broken at entry ${data.brokenAt}.`);
      }
    } catch {
      setState("invalid");
      setDetail("Verification request failed.");
    }
  }

  return (
    <div className="flex items-center gap-3">
      {state === "valid" && (
        <Badge variant="green">✓ Chain intact — {detail}</Badge>
      )}
      {state === "invalid" && (
        <Badge variant="red">✗ Tampered — {detail}</Badge>
      )}
      <Button
        onClick={handleVerify}
        loading={state === "loading"}
        variant="secondary"
        size="sm"
      >
        Verify chain
      </Button>
    </div>
  );
}
