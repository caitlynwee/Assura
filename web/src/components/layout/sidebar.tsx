"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileTextIcon,
  InboxIcon,
  LayoutGridIcon,
  LockIcon,
  MessagesSquareIcon,
  SettingsIcon,
  ScrollTextIcon,
  SendIcon,
  ShieldCheckIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Logo from "@/components/brand/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useViewMode } from "@/components/view-mode/view-mode-provider";
import type { UserTier } from "@/lib/types";
import { useT } from "@/lib/i18n/client";
import type { Messages } from "@/lib/i18n/messages";

type NavKey = keyof Messages["layout"]["nav"];

const NAV_ITEMS: { href: string; labelKey: NavKey; icon: LucideIcon; premium: boolean }[] = [
  { href: "/compare", labelKey: "compare", icon: LayoutGridIcon, premium: false },
  { href: "/chat", labelKey: "chat", icon: MessagesSquareIcon, premium: false },
  { href: "/policies", labelKey: "policyChat", icon: FileTextIcon, premium: false },
  { href: "/outreach", labelKey: "outreach", icon: SendIcon, premium: true },
  { href: "/crm", labelKey: "crm", icon: InboxIcon, premium: true },
  { href: "/activity", labelKey: "activity", icon: ScrollTextIcon, premium: true },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  trailing,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </Link>
  );
}

export default function Sidebar({ tier, onboarded }: { tier: UserTier; onboarded: boolean }) {
  const pathname = usePathname();
  // COSMETIC gating only. The `tier` prop seeds the correct nav on first server
  // render (no flash); the context value lets an admin's in-app view switch
  // reflect instantly without a server round-trip. This is NOT a security
  // boundary — real authorization stays in the edge middleware.
  const { viewTier } = useViewMode();
  const effectiveTier = viewTier ?? tier;
  const isPremium = effectiveTier === "premium";
  const isAdmin = effectiveTier === "admin";
  const hasOutreachAccess = isPremium || isAdmin;
  const t = useT().layout.nav;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-4">
        <Logo href="/compare" />
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label={t.main}>
        <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t.workspace}
        </p>
        {NAV_ITEMS.map(({ labelKey, ...item }) => {
          const locked = item.premium && !hasOutreachAccess;
          return (
            <NavLink
              key={item.href}
              {...item}
              label={t[labelKey]}
              active={pathname.startsWith(item.href)}
              trailing={
                locked ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <LockIcon className="size-3.5 text-muted-foreground" aria-label={t.premiumFeature} />
                    </TooltipTrigger>
                    <TooltipContent side="right">{t.premiumFeature}</TooltipContent>
                  </Tooltip>
                ) : undefined
              }
            />
          );
        })}
      </nav>

      <div className="border-t p-3">
        {isAdmin && (
          <NavLink
            href="/admin"
            label={t.admin}
            icon={WrenchIcon}
            active={pathname.startsWith("/admin")}
          />
        )}
        <NavLink
          href="/settings"
          label={t.settings}
          icon={SettingsIcon}
          active={pathname.startsWith("/settings")}
        />
        <NavLink
          href={hasOutreachAccess ? "/onboarding" : "/upgrade"}
          label={t.privacy}
          icon={ShieldCheckIcon}
          active={pathname.startsWith("/onboarding")}
          trailing={
            hasOutreachAccess && !onboarded ? (
              <span className="size-2 rounded-full bg-amber-500" title={t.setupNeeded} />
            ) : undefined
          }
        />
      </div>
    </aside>
  );
}
