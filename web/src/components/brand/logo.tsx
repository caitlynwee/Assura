import Link from "next/link";
import { cn } from "@/lib/utils";

export function ShieldMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-6", className)}>
      {/* Shield silhouette — matches the app icon (src/app/icon.svg) */}
      <path
        d="M12 2.5 4 5.6v6.1c0 4.9 3.4 8.6 8 9.8 4.6-1.2 8-4.9 8-9.8V5.6L12 2.5Z"
        className="fill-primary"
      />
      {/* Three ascending comparison bars, solid foreground color for crisp
          legibility at small (navbar/favicon) sizes — no opacity washout. */}
      <g className="fill-primary-foreground">
        <rect x="7" y="13" width="2.8" height="3.5" rx="0.6" />
        <rect x="10.6" y="11" width="2.8" height="5.5" rx="0.6" />
        <rect x="14.2" y="9" width="2.8" height="7.5" rx="0.6" />
      </g>
    </svg>
  );
}

export default function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 font-semibold tracking-tight text-foreground", className)}
    >
      <ShieldMark />
      <span className="text-lg">Assura</span>
    </Link>
  );
}
