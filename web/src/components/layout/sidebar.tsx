"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import Logo from "@/components/brand/logo";
import type { UserTier } from "@/lib/types";

const NAV_ITEMS = [
  { href: "/compare", label: "Compare Plans", icon: "⊞", premium: false },
  { href: "/chat", label: "Plan Q&A", icon: "💬", premium: false },
  { href: "/outreach", label: "Outreach", icon: "✉", premium: true },
  { href: "/crm", label: "CRM", icon: "📋", premium: true },
  { href: "/activity", label: "Activity Log", icon: "🔍", premium: true },
];

export default function Sidebar({ tier, onboarded }: { tier: UserTier; onboarded: boolean }) {
  const pathname = usePathname();
  const isPremium = tier === "premium";

  const settingsHref = isPremium ? "/onboarding" : "/upgrade";

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-14 items-center border-b border-gray-200 px-4">
        <Logo href="/compare" />
      </div>
      <nav className="flex-1 space-y-0.5 px-2 py-4">
        {NAV_ITEMS.map((item) => {
          const locked = item.premium && !isPremium;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <span className="text-base" aria-hidden="true">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {locked && (
                <span className="text-[10px] font-semibold uppercase text-gray-400" title="Premium">
                  🔒
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 p-2">
        <Link
          href={settingsHref}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
            pathname.startsWith("/onboarding")
              ? "bg-blue-50 text-blue-700"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          )}
        >
          <span aria-hidden="true">🛡</span>
          <span className="flex-1">Privacy &amp; consent</span>
          {isPremium && !onboarded && (
            <span className="h-2 w-2 rounded-full bg-amber-500" title="Setup needed" />
          )}
        </Link>
      </div>
    </aside>
  );
}
