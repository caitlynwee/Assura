import Badge from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import type { ThreadMessage } from "@/lib/types";

interface Props {
  messages: ThreadMessage[];
}

export default function ThreadTimeline({ messages }: Props) {
  if (messages.length === 0) {
    return (
      <p className="text-sm text-gray-400">No messages in this thread yet.</p>
    );
  }

  return (
    <ol className="space-y-4">
      {messages.map((message) => {
        const isInbound = message.direction === "inbound";
        return (
          <li
            key={message.id}
            className={cn(
              "flex",
              isInbound ? "justify-start" : "justify-end"
            )}
          >
            <div
              className={cn(
                "w-full max-w-2xl rounded-xl border p-4",
                isInbound
                  ? "border-gray-200 bg-white"
                  : "border-blue-200 bg-blue-50"
              )}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={isInbound ? "gray" : "blue"}>
                  {isInbound ? "↩ Inbound" : "↪ Outbound"}
                </Badge>
                {message.aiGenerated && (
                  <Badge variant="purple">AI-generated</Badge>
                )}
                {message.flagged && <Badge variant="red">⚠ Flagged</Badge>}
                <span className="ml-auto text-xs text-gray-400">
                  {formatDate(message.timestamp)}
                </span>
              </div>

              <div className="mt-2 text-xs text-gray-500">
                <span className="font-medium text-gray-700">From:</span>{" "}
                {message.from}
                <span className="mx-1">·</span>
                <span className="font-medium text-gray-700">To:</span>{" "}
                {message.to}
              </div>

              {message.subject && (
                <p className="mt-2 text-sm font-medium text-gray-900">
                  {message.subject}
                </p>
              )}

              <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                {message.body}
              </p>

              {message.flagged && message.flagReason && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-xs font-semibold text-red-800">
                    Flag reason
                  </p>
                  <p className="text-xs text-red-700 mt-0.5">
                    {message.flagReason}
                  </p>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
