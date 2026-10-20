"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HistoryIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { useChat } from "@/hooks/use-chat";
import { useConversations, useTrash } from "@/hooks/use-conversations";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ChatConversation } from "@/lib/types";
import ChatHistorySidebar from "./chat-history-sidebar";
import ChatTrashDialog from "./chat-trash-dialog";
import ChatWindow from "./chat-window";
import { useT } from "@/lib/i18n/client";

/**
 * Plan Q&A with saved history: a conversation list on the left (new chat,
 * switch, move to "Recently deleted") and the active conversation on the
 * right. The active id lives in `?c=` so a refresh reopens the same chat.
 */
export default function ChatWorkspace() {
  const searchParams = useSearchParams();
  const [activeId, setActiveIdState] = useState<string | null>(searchParams.get("c"));
  const [showHistoryMobile, setShowHistoryMobile] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const t = useT().chat;

  const { conversations, loading: listLoading, error: listError, refresh, remove, restore } =
    useConversations();
  const trash = useTrash(trashOpen);

  // Keep the URL in sync without a Next navigation (which would remount state).
  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
    const url = id ? `/chat?c=${encodeURIComponent(id)}` : "/chat";
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const { messages, sendMessage, editMessage, streaming, loading } = useChat(activeId, {
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

  async function moveToTrash(c: ChatConversation) {
    const ok = await remove(c.id);
    if (!ok) {
      toast.error(t.deleteFailed);
      return;
    }
    if (c.id === activeId) setActiveId(null);
    toast(t.movedToBin, {
      description: c.title,
      action: {
        label: t.undo,
        onClick: async () => {
          if (await restore(c.id)) trash.forget(c.id);
          else toast.error(t.restoreFailed);
        },
      },
    });
  }

  async function restoreFromTrash(id: string) {
    const ok = await restore(id);
    if (ok) {
      trash.forget(id);
      toast.success(t.restored);
    }
    return ok;
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
      onDelete={(c) => void moveToTrash(c)}
      onOpenTrash={() => {
        setShowHistoryMobile(false);
        setTrashOpen(true);
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
            aria-label={t.closeHistory}
            className="flex-1 bg-black/30"
            onClick={() => setShowHistoryMobile(false)}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b px-3 py-2 md:hidden">
          <Button variant="ghost" size="sm" onClick={() => setShowHistoryMobile(true)}>
            <HistoryIcon />
            {t.history}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={newChat}
            disabled={streaming}
          >
            <PlusIcon />
            {t.newChat}
          </Button>
        </div>
        <ChatWindow
          messages={messages}
          sendMessage={sendMessage}
          editMessage={editMessage}
          streaming={streaming}
          loading={loading}
        />
      </div>

      <ChatTrashDialog
        open={trashOpen}
        onOpenChange={setTrashOpen}
        items={trash.items}
        retentionDays={trash.retentionDays}
        loading={trash.loading}
        error={trash.error}
        onRestore={restoreFromTrash}
        onDeleteForever={trash.deleteForever}
        onEmpty={trash.empty}
      />
    </Card>
  );
}
