"use client";

/**
 * view-mode-provider.tsx — Client context for the admin-only "View as role" switcher.
 *
 * COSMETIC ONLY. Changing the view tier changes what the UI *renders*; it never
 * changes the real tier, DB row, Supabase app_metadata, or session. Real
 * authorization stays in the edge middleware (`auth-routing.ts`). A non-admin can
 * never change the view — `setViewTier` is a no-op unless `canSwitch` is true.
 *
 * Do NOT import any server/DB/node-only module here.
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { UserTier } from "@/lib/types";
import { VIEW_COOKIE_NAME, VIEW_STORAGE_KEY, isValidViewTier } from "@/lib/view-mode";

interface ViewModeContextValue {
  /** The user's actual tier (server truth). Never changes client-side. */
  realTier: UserTier;
  /** The cosmetic preview tier currently rendered. */
  viewTier: UserTier;
  /** Only real admins may switch the view. */
  canSwitch: boolean;
  /** Set the cosmetic preview tier. No-op for non-admins. */
  setViewTier: (next: UserTier) => void;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

export function ViewModeProvider({
  realTier,
  initialViewTier,
  children,
}: {
  realTier: UserTier;
  /** Already admin-resolved by the server layout (same cookie value the client reads). */
  initialViewTier: UserTier;
  children: ReactNode;
}) {
  const canSwitch = realTier === "admin";
  const [viewTier, setViewTierState] = useState<UserTier>(initialViewTier);

  const setViewTier = useCallback(
    (next: UserTier) => {
      // Hard guard: non-admins can never change the cosmetic view.
      if (!canSwitch || !isValidViewTier(next)) return;
      setViewTierState(next);
      // Persist for the client fast path and so the server layout renders the
      // right nav on the next refresh. Cookie is intentionally non-httpOnly /
      // non-secure — it carries NO security meaning (see view-mode.ts).
      if (typeof document !== "undefined") {
        document.cookie = `${VIEW_COOKIE_NAME}=${next}; path=/; max-age=31536000; samesite=lax`;
      }
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(VIEW_STORAGE_KEY, next);
        } catch {
          // localStorage can throw (private mode / quota); non-fatal for a cosmetic pref.
        }
      }
    },
    [canSwitch]
  );

  const value = useMemo<ViewModeContextValue>(
    () => ({ realTier, viewTier, canSwitch, setViewTier }),
    [realTier, viewTier, canSwitch, setViewTier]
  );

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode(): ViewModeContextValue {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error("useViewMode must be used within a ViewModeProvider");
  return ctx;
}
