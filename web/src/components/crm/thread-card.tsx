"use client";

import Link from "next/link";
import { CornerDownLeftIcon, CornerUpRightIcon, FlagIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { Thread } from "@/lib/types";
import { useLocale, useT } from "@/lib/i18n/client";

export const STATUS_VARIANTS: Record<string, "blue" | "green" | "yellow" | "red" | "orange" | "gray" | "purple"> = {
  draft: "gray",
  awaiting_approval: "yellow",
  sent: "blue",
  replied: "purple",
  info_received: "green",
  flagged: "red",
  closed: "gray",
};

interface Props {
  thread: Thread;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

export default function ThreadCard({ thread }: Props) {
  const lastMessage = thread.messages.at(-1);
  const t = useT().crm;
  const { intlLocale } = useLocale();

  return (
    <Link href={`/crm/${thread.id}`} className="group block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
      <Card className="flex-row items-start gap-4 px-4 py-4 transition-colors group-hover:border-primary/40 group-hover:bg-accent/30">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground"
          aria-hidden="true"
        >
          {initials(thread.insurerName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium">{thread.insurerName}</p>
            <Badge variant={STATUS_VARIANTS[thread.status] ?? "gray"}>
              {t.status[thread.status] ?? thread.status}
            </Badge>
            {thread.riskFlags.length > 0 && (
              <Badge variant="red">
                <FlagIcon />
                {t.flagged}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{thread.subject}</p>
          {lastMessage && (
            <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              {lastMessage.direction === "inbound" ? (
                <CornerDownLeftIcon className="size-3 shrink-0" aria-label={t.reply} />
              ) : (
                <CornerUpRightIcon className="size-3 shrink-0" aria-label={t.sent} />
              )}
              <span className="truncate">{lastMessage.body.slice(0, 100)}</span>
            </p>
          )}
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">{formatDate(thread.updatedAt, intlLocale)}</p>
      </Card>
    </Link>
  );
}
