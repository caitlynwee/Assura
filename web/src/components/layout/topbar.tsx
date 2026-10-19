"use client";

import { signOut } from "next-auth/react";
import type { User } from "next-auth";
import { cn } from "@/lib/utils";

interface TopbarProps {
  user: User & { tier?: string };
}

export default function Topbar({ user }: TopbarProps) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-end px-6 gap-4">
      <span
        className={cn(
          "text-xs font-medium px-2 py-1 rounded-full",
          (user as { tier?: string }).tier === "premium"
            ? "bg-blue-100 text-blue-700"
            : "bg-gray-100 text-gray-600"
        )}
      >
        {(user as { tier?: string }).tier === "premium" ? "Premium" : "Free"}
      </span>
      <span className="text-sm text-gray-600">{user.email}</span>
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="text-sm text-gray-500 hover:text-gray-900 transition"
      >
        Sign out
      </button>
    </header>
  );
}
