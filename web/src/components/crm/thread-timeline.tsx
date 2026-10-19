import { BotIcon, CornerDownLeftIcon, CornerUpRightIcon, FlagIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils";
import type { ThreadMessage } from "@/lib/types";

interface Props {
  messages: ThreadMessage[];
}

export default function ThreadTimeline({ messages }: Props) {
  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground">No messages in this thread yet.</p>;
  }

  return (
    <ol className="space-y-4">
      {messages.map((message) => {
        const isInbound = message.direction === "inbound";
        return (
          <li key={message.id} className={cn("flex", isInbound ? "justify-start" : "justify-end")}>
            <Card
              className={cn(
                "w-full max-w-2xl gap-0 py-4",
                !isInbound && "border-primary/30 bg-accent/40",
                message.flagged && "border-red-300"
              )}
            >
              <CardContent className="space-y-2 px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={isInbound ? "gray" : "blue"}>
                    {isInbound ? <CornerDownLeftIcon /> : <CornerUpRightIcon />}
                    {isInbound ? "Inbound" : "Outbound"}
                  </Badge>
                  {message.aiGenerated && (
                    <Badge variant="purple">
                      <BotIcon />
                      AI-generated
                    </Badge>
                  )}
                  {message.flagged && (
                    <Badge variant="red">
                      <FlagIcon />
                      Flagged
                    </Badge>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">{formatDate(message.timestamp)}</span>
                </div>

                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">From:</span> {message.from}
                  <span className="mx-1">·</span>
                  <span className="font-medium text-foreground">To:</span> {message.to}
                </p>

                {message.subject && <p className="text-sm font-medium">{message.subject}</p>}

                <p className="whitespace-pre-wrap text-sm text-foreground/90">{message.body}</p>

                {message.flagged && message.flagReason && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-xs font-semibold text-red-800">Flag reason</p>
                    <p className="mt-0.5 text-xs text-red-700">{message.flagReason}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
