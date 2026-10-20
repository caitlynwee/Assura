"use client";

import { useState } from "react";
import { ShieldCheckIcon, ShieldXIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

type VerifyState = "idle" | "loading" | "valid" | "invalid";

export default function VerifyChainButton() {
  const [state, setState] = useState<VerifyState>("idle");
  const [detail, setDetail] = useState<string>("");
  const t = useT().activity;

  async function handleVerify() {
    setState("loading");
    try {
      const res = await fetch("/api/audit/verify", { method: "POST" });
      const data = await res.json();
      if (data.valid) {
        setState("valid");
        setDetail(t.entriesVerified(data.entries));
      } else {
        setState("invalid");
        setDetail(t.brokenAt(data.brokenAt));
      }
    } catch {
      setState("invalid");
      setDetail(t.verifyFailed);
    }
  }

  return (
    <div className="flex items-center gap-3" aria-live="polite">
      {state === "valid" && (
        <Badge variant="green" className="h-7 px-2.5 text-sm">
          <ShieldCheckIcon className="!size-4" />
          {t.intact} — {detail}
        </Badge>
      )}
      {state === "invalid" && (
        <Badge variant="red" className="h-7 px-2.5 text-sm">
          <ShieldXIcon className="!size-4" />
          {t.tampered} — {detail}
        </Badge>
      )}
      <Button onClick={handleVerify} loading={state === "loading"}>
        {state !== "loading" && <ShieldCheckIcon />}
        {t.verify}
      </Button>
    </div>
  );
}
