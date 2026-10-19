import { BotIcon, FileTextIcon, UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/lib/types";

interface Props {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <Avatar className="size-8">
        <AvatarFallback className={isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}>
          {isUser ? <UserIcon className="size-4" /> : <BotIcon className="size-4" />}
        </AvatarFallback>
      </Avatar>
      <div className={cn("flex max-w-[80%] flex-col gap-2", isUser && "items-end")}>
        <div
          className={cn(
            "whitespace-pre-wrap rounded-lg px-4 py-3 text-sm",
            isUser ? "bg-primary text-primary-foreground" : "border bg-muted/50"
          )}
        >
          {message.content}
        </div>
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.citations.map((c) => (
              <Badge key={c.planId} variant="outline" asChild className="font-normal">
                <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <FileTextIcon />
                  {c.planName}
                </a>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
