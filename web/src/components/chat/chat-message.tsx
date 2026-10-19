import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/lib/types";

interface Props {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap",
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-800"
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
