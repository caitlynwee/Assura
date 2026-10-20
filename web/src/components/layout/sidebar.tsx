"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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
import type { UserTier } from "@/lib/types";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon; premium: boolean }[] = [
  { href: "/compare", label: "Compare Plans", icon: LayoutGridIcon, premium: false },
  { href: "/chat", label: "Plan Q&A", icon: MessagesSquareIcon, premium: false },
  { href: "/outreach", label: "Outreach", icon: SendIcon, premium: true },
  { href: "/crm", label: "CRM", icon: InboxIcon, premium: true },
  { href: "/activity", label: "Activity Log", icon: ScrollTextIcon, premium: true },
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
  const isPremium = tier === "premium";
  const isAdmin = tier === "admin";
  const hasOutreachAccess = isPremium || isAdmin;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-4">
        <Logo href="/compare" />
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="Main">
        <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Workspace
        </p>
        {NAV_ITEMS.map((item) => {
          const locked = item.premium && !hasOutreachAccess;
          return (
            <NavLink
              key={item.href}
              {...item}
              active={pathname.startsWith(item.href)}
              trailing={
                locked ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <LockIcon className="size-3.5 text-muted-foreground" aria-label="Premium" />
                    </TooltipTrigger>
                    <TooltipContent side="right">Premium feature</TooltipContent>
                  </Tooltip>
                ) : undefined
              }
            />
          );
        })}
        {isAdmin && (
          <NavLink
            href="/admin"
            label="Admin dashboard"
            icon={WrenchIcon}
            active={pathname.startsWith("/admin")}
          />
        )}
      </nav>

      <div className="border-t p-3">
        <NavLink
          href="/settings"
          label="Settings"
          icon={SettingsIcon}
          active={pathname.startsWith("/settings")}
        />
        <NavLink
          href={hasOutreachAccess ? "/onboarding" : "/upgrade"}
          label="Privacy & consent"
          icon={ShieldCheckIcon}
          active={pathname.startsWith("/onboarding")}
          trailing={
            hasOutreachAccess && !onboarded ? (
              <span className="size-2 rounded-full bg-amber-500" title="Setup needed" />
            ) : undefined
          }
        />
      </div>
    </aside>
  );
}
