"use client";

import { useState } from "react";
import { ShieldCheckIcon, ShieldXIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
        setDetail(`${data.entries} entries verified`);
      } else {
        setState("invalid");
        setDetail(`chain broken at entry ${data.brokenAt}`);
      }
    } catch {
      setState("invalid");
      setDetail("verification request failed");
    }
  }

  return (
    <div className="flex items-center gap-3" aria-live="polite">
      {state === "valid" && (
        <Badge variant="green" className="h-7 px-2.5 text-sm">
          <ShieldCheckIcon className="!size-4" />
          Chain intact — {detail}
        </Badge>
      )}
      {state === "invalid" && (
        <Badge variant="red" className="h-7 px-2.5 text-sm">
          <ShieldXIcon className="!size-4" />
          Tampered — {detail}
        </Badge>
      )}
      <Button onClick={handleVerify} loading={state === "loading"}>
        {state !== "loading" && <ShieldCheckIcon />}
        Verify chain
      </Button>
    </div>
  );
}
