"use client";

/**
 * view-as-switcher.tsx — Admin-only "View as role" control in the topbar.
 *
 * COSMETIC ONLY. This simulates what a lower tier would see; it is NOT a security
 * boundary and does not change the real tier, DB, or session. Real authorization
 * stays in the edge middleware (`auth-routing.ts`).
 */

import { EyeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserTier } from "@/lib/types";
import { useViewMode } from "./view-mode-provider";

const VIEW_OPTIONS: { value: UserTier; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "premium", label: "Premium" },
  { value: "admin", label: "Admin" },
];

function label(tier: UserTier) {
  return VIEW_OPTIONS.find((o) => o.value === tier)?.label ?? tier;
}

export default function ViewAsSwitcher() {
  const { viewTier, canSwitch, setViewTier } = useViewMode();

  // Double safety: only real admins ever see this control. Non-admins render nothing.
  if (!canSwitch) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <EyeIcon />
          <span className="hidden sm:inline">View as:</span>
          {label(viewTier)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
          Preview the app as (cosmetic)
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={viewTier}
          onValueChange={(v) => setViewTier(v as UserTier)}
        >
          {VIEW_OPTIONS.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
