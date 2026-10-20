"use client";

/**
 * ToastOnParam — fires a one-shot toast when the URL carries a known toast key,
 * then strips the param so a refresh doesn't re-fire it.
 *
 * Used for feedback that must survive a server-action redirect (e.g. "account
 * created" shown on /onboarding after signupAction redirects there). The server
 * action can't show a toast itself because it navigates away; it redirects with
 * ?toast=<key> and the destination page renders <ToastOnParam />.
 */

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/client";

// Toast type per key; the text comes from the i18n dictionary (t.toast[key]).
const TYPES: Record<string, "success" | "error" | "info"> = {
  signup: "success",
  login: "success",
  upgraded: "success",
  downgraded: "success",
  "already-free": "info",
  "downgrade-demo-blocked": "error",
  onboarded: "success",
  loggedout: "info",
  "signin-failed": "error",
  "account-deleted": "success",
  "delete-unconfirmed": "error",
  "delete-demo-blocked": "error",
};

export default function ToastOnParam({ param = "toast" }: { param?: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const fired = useRef(false);
  const texts = useT().toast as Record<string, string>;

  const key = searchParams.get(param);

  useEffect(() => {
    if (!key || fired.current) return;
    const type = TYPES[key];
    const text = texts[key];
    if (type && text) {
      fired.current = true;
      toast[type](text);
      // Strip the param so refresh/back doesn't replay the toast.
      const next = new URLSearchParams(searchParams.toString());
      next.delete(param);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [key, param, pathname, router, searchParams, texts]);

  return null;
}
