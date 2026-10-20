"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HistoryIcon, PlusIcon } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { useConversations } from "@/hooks/use-conversations";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ChatConversation } from "@/lib/types";
import ChatHistorySidebar from "./chat-history-sidebar";
import ChatWindow from "./chat-window";

/**
 * Plan Q&A with saved history: a conversation list on the left (new chat,
 * switch, delete) and the active conversation on the right. The active id
 * lives in `?c=` so a refresh reopens the same chat.
 */
export default function ChatWorkspace() {
  const searchParams = useSearchParams();
  const [activeId, setActiveIdState] = useState<string | null>(searchParams.get("c"));
  const [showHistoryMobile, setShowHistoryMobile] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChatConversation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { conversations, loading: listLoading, error: listError, refresh, remove } =
    useConversations();

  // Keep the URL in sync without a Next navigation (which would remount state).
  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
    const url = id ? `/chat?c=${encodeURIComponent(id)}` : "/chat";
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const { messages, sendMessage, streaming, loading } = useChat(activeId, {
    onConversationCreated: (id) => {
      setActiveId(id);
      void refresh();
    },
    onActivity: () => void refresh(),
    // A stale or deleted ?c= id falls back to a fresh chat.
    onNotFound: () => setActiveId(null),
  });

  function selectConversation(id: string) {
    setActiveId(id);
    setShowHistoryMobile(false);
  }

  function newChat() {
    setActiveId(null);
    setShowHistoryMobile(false);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    const ok = await remove(pendingDelete.id);
    setDeleting(false);
    if (!ok) {
      setDeleteError("Couldn't delete this chat. Please try again.");
      return;
    }
    if (pendingDelete.id === activeId) setActiveId(null);
    setPendingDelete(null);
  }

  const sidebar = (
    <ChatHistorySidebar
      conversations={conversations}
      activeId={activeId}
      loading={listLoading}
      error={listError}
      disabled={streaming}
      onSelect={selectConversation}
      onNewChat={newChat}
      onDelete={(c) => {
        setDeleteError(null);
        setPendingDelete(c);
      }}
    />
  );

  return (
    <Card className="relative flex h-full flex-row gap-0 overflow-hidden py-0">
      {/* Desktop history column */}
      <aside className="hidden w-64 shrink-0 border-r bg-muted/20 md:block">{sidebar}</aside>

      {/* Mobile history drawer */}
      {showHistoryMobile && (
        <div className="absolute inset-0 z-20 flex md:hidden">
          <aside className="w-72 max-w-[85%] border-r bg-card shadow-lg">{sidebar}</aside>
          <button
            type="button"
            aria-label="Close chat history"
            className="flex-1 bg-black/30"
            onClick={() => setShowHistoryMobile(false)}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b px-3 py-2 md:hidden">
          <Button variant="ghost" size="sm" onClick={() => setShowHistoryMobile(true)}>
            <HistoryIcon />
            History
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={newChat}
            disabled={streaming}
          >
            <PlusIcon />
            New chat
          </Button>
        </div>
        <ChatWindow
          messages={messages}
          sendMessage={sendMessage}
          streaming={streaming}
          loading={loading}
        />
      </div>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this chat?</DialogTitle>
            <DialogDescription>
              &ldquo;{pendingDelete?.title}&rdquo; and all its messages will be permanently
              deleted. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
              className={cn(deleting && "opacity-70")}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
