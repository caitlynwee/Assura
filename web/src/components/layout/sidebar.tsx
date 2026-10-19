"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/compare", label: "Compare Plans", icon: "⊞" },
  { href: "/chat", label: "Plan Q&A", icon: "💬" },
  { href: "/outreach", label: "Outreach", icon: "✉" },
  { href: "/crm", label: "CRM", icon: "📋" },
  { href: "/activity", label: "Activity Log", icon: "🔍" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
      <div className="h-14 flex items-center px-4 border-b border-gray-200">
        <Link href="/compare" className="text-lg font-bold text-blue-600">
          Fineprint
        </Link>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition",
              pathname.startsWith(item.href)
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
