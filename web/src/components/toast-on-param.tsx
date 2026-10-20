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

const MESSAGES: Record<string, { type: "success" | "error" | "info"; text: string }> = {
  signup: { type: "success", text: "Account created — welcome to Assura." },
  login: { type: "success", text: "Signed in." },
  upgraded: { type: "success", text: "You're now on Premium." },
  downgraded: { type: "success", text: "Your account is now on the Free plan." },
  "already-free": { type: "info", text: "Your account is already on the Free plan." },
  "downgrade-demo-blocked": { type: "error", text: "The shared demo account must stay on Premium." },
  onboarded: { type: "success", text: "Preferences saved." },
  loggedout: { type: "info", text: "You've been signed out." },
  "signin-failed": { type: "error", text: "Invalid email or password." },
  "account-deleted": { type: "success", text: "Your account has been deleted." },
  "delete-unconfirmed": { type: "error", text: "Account deletion not confirmed." },
  "delete-demo-blocked": { type: "error", text: "The demo account can't be deleted." },
};

export default function ToastOnParam({ param = "toast" }: { param?: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const fired = useRef(false);

  const key = searchParams.get(param);

  useEffect(() => {
    if (!key || fired.current) return;
    const entry = MESSAGES[key];
    if (entry) {
      fired.current = true;
      toast[entry.type](entry.text);
      // Strip the param so refresh/back doesn't replay the toast.
      const next = new URLSearchParams(searchParams.toString());
      next.delete(param);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [key, param, pathname, router, searchParams]);

  return null;
}
