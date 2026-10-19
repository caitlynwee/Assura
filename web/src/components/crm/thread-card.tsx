import Link from "next/link";
import Badge from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { Thread } from "@/lib/types";

const STATUS_VARIANTS: Record<string, "blue" | "green" | "yellow" | "red" | "orange" | "gray" | "purple"> = {
  draft: "gray",
  awaiting_approval: "yellow",
  sent: "blue",
  replied: "purple",
  info_received: "green",
  flagged: "red",
  closed: "gray",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  awaiting_approval: "Awaiting Approval",
  sent: "Sent",
  replied: "Replied",
  info_received: "Info Received",
  flagged: "Flagged",
  closed: "Closed",
};

interface Props {
  thread: Thread;
}

export default function ThreadCard({ thread }: Props) {
  const lastMessage = thread.messages.at(-1);

  return (
    <Link
      href={`/crm/${thread.id}`}
      className="block bg-white border rounded-xl p-4 hover:border-blue-300 transition group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-gray-900 truncate">{thread.insurerName}</p>
            <Badge variant={STATUS_VARIANTS[thread.status] ?? "gray"}>
              {STATUS_LABELS[thread.status] ?? thread.status}
            </Badge>
            {thread.riskFlags.length > 0 && (
              <Badge variant="red">⚠ Flagged</Badge>
            )}
          </div>
          <p className="text-sm text-gray-500 truncate mt-0.5">{thread.subject}</p>
          {lastMessage && (
            <p className="text-xs text-gray-400 mt-1 truncate">
              {lastMessage.direction === "inbound" ? "↩ " : "↪ "}
              {lastMessage.body.slice(0, 80)}...
            </p>
          )}
        </div>
        <p className="text-xs text-gray-400 flex-shrink-0">
          {formatDate(thread.updatedAt)}
        </p>
      </div>
    </Link>
  );
}
