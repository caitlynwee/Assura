"use client";

import { MessageSquareIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ChatConversation } from "@/lib/types";

interface Props {
  conversations: ChatConversation[];
  activeId: string | null;
  loading: boolean;
  error: string | null;
  disabled?: boolean;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (conversation: ChatConversation) => void;
}

const DAY = 24 * 60 * 60 * 1000;

/** Bucket conversations by last activity, like most chat apps. */
function groupByRecency(conversations: ChatConversation[]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();

  const groups: { label: string; items: ChatConversation[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];
  for (const c of conversations) {
    const t = new Date(c.updatedAt).getTime();
    if (t >= today) groups[0].items.push(c);
    else if (t >= today - DAY) groups[1].items.push(c);
    else if (t >= today - 7 * DAY) groups[2].items.push(c);
    else groups[3].items.push(c);
  }
  return groups.filter((g) => g.items.length > 0);
}

export default function ChatHistorySidebar({
  conversations,
  activeId,
  loading,
  error,
  disabled,
  onSelect,
  onNewChat,
  onDelete,
}: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onNewChat}
          disabled={disabled}
        >
          <PlusIcon />
          New chat
        </Button>
      </div>

      <nav aria-label="Chat history" className="flex-1 overflow-y-auto px-2 pb-3">
        {loading && (
          <div className="space-y-2 px-1 pt-1">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-5/6" />
            <Skeleton className="h-8 w-4/6" />
          </div>
        )}

        {!loading && error && (
          <p className="px-2 pt-1 text-sm text-destructive">{error}</p>
        )}

        {!loading && !error && conversations.length === 0 && (
          <p className="px-2 pt-1 text-sm text-muted-foreground">
            No saved chats yet. Your conversations will appear here.
          </p>
        )}

        {!loading &&
          groupByRecency(conversations).map((group) => (
            <div key={group.label} className="mb-3">
              <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((c) => {
                  const active = c.id === activeId;
                  return (
                    <li key={c.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => onSelect(c.id)}
                        disabled={disabled}
                        aria-current={active ? "page" : undefined}
                        title={c.title}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md py-2 pl-2 pr-9 text-left text-sm transition-colors",
                          "hover:bg-accent hover:text-accent-foreground disabled:opacity-60",
                          active && "bg-accent font-medium text-accent-foreground"
                        )}
                      >
                        <MessageSquareIcon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{c.title}</span>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete chat: ${c.title}`}
                        onClick={() => onDelete(c)}
                        disabled={disabled}
                        className={cn(
                          "absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground hover:text-destructive",
                          "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
                          active && "md:opacity-100"
                        )}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
      </nav>
    </div>
  );
}
