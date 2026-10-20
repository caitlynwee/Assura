"use client";

import { useState } from "react";
import { BotIcon, FileTextIcon, PencilIcon, UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/lib/types";

interface Props {
  message: ChatMessageType;
  /**
   * Present on user messages that can be edited. Called with the new text;
   * the conversation is cut at this message and the answer regenerated.
   */
  onEdit?: (content: string) => void;
}

const MAX_LENGTH = 2000;

export default function ChatMessage({ message, onEdit }: Props) {
  const isUser = message.role === "user";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  const trimmed = draft.trim();
  const canSave = trimmed.length > 0 && trimmed.length <= MAX_LENGTH;

  function startEditing() {
    setDraft(message.content);
    setEditing(true);
  }

  function save() {
    if (!canSave || !onEdit) return;
    setEditing(false);
    // Unchanged text still regenerates, like "retry" in other chat apps.
    onEdit(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditing(false);
    }
  }

  return (
    <div className={cn("group flex gap-3", isUser && "flex-row-reverse")}>
      <Avatar className="size-8">
        <AvatarFallback className={isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}>
          {isUser ? <UserIcon className="size-4" /> : <BotIcon className="size-4" />}
        </AvatarFallback>
      </Avatar>

      {editing ? (
        <div className="flex w-full max-w-[80%] flex-col gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            rows={3}
            maxLength={MAX_LENGTH}
            aria-label="Edit your message"
            className="resize-none bg-card"
          />
          <div className="flex items-center justify-end gap-2">
            <span className="mr-auto text-xs text-muted-foreground">
              Enter to send · Esc to cancel
            </span>
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={!canSave}>
              Send
            </Button>
          </div>
        </div>
      ) : (
        <div className={cn("flex max-w-[80%] flex-col gap-2", isUser && "items-end")}>
          <div
            className={cn(
              "whitespace-pre-wrap rounded-lg px-4 py-3 text-sm",
              isUser ? "bg-primary text-primary-foreground" : "border bg-muted/50"
            )}
          >
            {message.content}
          </div>
          {isUser && onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={startEditing}
              aria-label="Edit message"
              className="h-7 px-2 text-xs text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            >
              <PencilIcon className="size-3.5" />
              Edit
            </Button>
          )}
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
      )}
    </div>
  );
}
