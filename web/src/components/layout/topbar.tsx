"use client";

import { useRef } from "react";
import Link from "next/link";
import { LogOutIcon, MailIcon, SettingsIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react";
import { logoutAction } from "@/app/_actions/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useViewMode } from "@/components/view-mode/view-mode-provider";
import ViewAsSwitcher from "@/components/view-mode/view-as-switcher";
import type { PublicUser } from "@/lib/types";
import { useT } from "@/lib/i18n/client";
import LanguageSwitcher from "@/components/i18n/language-switcher";

function initials(nameOrEmail: string) {
  const parts = nameOrEmail.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

export default function Topbar({ user }: { user: PublicUser }) {
  // Tier-derived booleans follow the COSMETIC view tier (presentation only).
  // Real identity fields (name/email/maskedInbox) still come from the real user.
  const { viewTier } = useViewMode();
  const premium = viewTier === "premium";
  const admin = viewTier === "admin";
  const hasOutreachAccess = premium || admin;
  const logoutForm = useRef<HTMLFormElement>(null);
  const tt = useT();
  const t = tt.layout.topbar;
  return (
    <header className="flex h-14 items-center justify-end gap-3 border-b bg-card px-6">
      <ViewAsSwitcher />
      <LanguageSwitcher />
      {hasOutreachAccess && user.maskedInbox && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="hidden gap-1.5 font-mono font-normal md:inline-flex">
              <MailIcon />
              {user.maskedInbox}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>{t.relayTooltip}</TooltipContent>
        </Tooltip>
      )}

      {admin ? (
        <Badge variant="blue">{tt.common.admin}</Badge>
      ) : premium ? (
        <Badge variant="blue">{tt.common.premium}</Badge>
      ) : (
        <Button asChild size="sm" variant="outline">
          <Link href="/upgrade">
            <SparklesIcon />
            {t.upgrade}
          </Link>
        </Button>
      )}

      <form ref={logoutForm} action={logoutAction} className="hidden" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 gap-2 px-2" aria-label={t.accountMenu}>
            <Avatar className="size-7">
              <AvatarFallback className="bg-accent text-accent-foreground">
                {initials(user.name || user.email)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">
              {user.name || user.email}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <SettingsIcon />
              {t.settings}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={hasOutreachAccess ? "/onboarding" : "/upgrade"}>
              <ShieldCheckIcon />
              {t.privacy}
            </Link>
          </DropdownMenuItem>
          {!hasOutreachAccess && (
            <DropdownMenuItem asChild>
              <Link href="/upgrade">
                <SparklesIcon />
                {t.upgradeToPremium}
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => logoutForm.current?.requestSubmit()}>
            <LogOutIcon />
            {t.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
