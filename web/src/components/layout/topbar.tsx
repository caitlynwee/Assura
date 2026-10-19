import Link from "next/link";
import { logoutAction } from "@/app/_actions/auth";
import { cn } from "@/lib/utils";
import type { PublicUser } from "@/lib/types";

export default function Topbar({ user }: { user: PublicUser }) {
  const premium = user.tier === "premium";

  return (
    <header className="flex h-14 items-center justify-end gap-4 border-b border-gray-200 bg-white px-6">
      {premium && user.maskedInbox && (
        <span
          className="hidden items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 font-mono text-xs text-gray-600 md:inline-flex"
          title="Insurers only ever see this relay address"
        >
          <span aria-hidden="true">✉</span>
          {user.maskedInbox}
        </span>
      )}

      {premium ? (
        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">Premium</span>
      ) : (
        <Link
          href="/upgrade"
          className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-blue-50 hover:text-blue-700"
        >
          Free · Upgrade
        </Link>
      )}

      <span className={cn("text-sm text-gray-700")} title={user.email}>
        {user.name || user.email}
      </span>

      <form action={logoutAction}>
        <button type="submit" className="text-sm text-gray-500 transition hover:text-gray-900">
          Sign out
        </button>
      </form>
    </header>
  );
}
