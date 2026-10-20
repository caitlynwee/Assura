"use client";

import { useCallback, useState } from "react";
import { FileTextIcon, HistoryIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { usePolicyDocuments } from "@/hooks/use-policy-documents";
import {
  usePolicyConversations,
  usePolicyTrash,
} from "@/hooks/use-policy-conversations";
import { usePolicyChat } from "@/hooks/use-policy-chat";
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
import type { PolicyConversation, PolicyDocument } from "@/lib/types";
import PolicyDocumentSidebar from "./policy-document-sidebar";
import PolicyChatHistorySidebar from "./policy-chat-history-sidebar";
import PolicyChatWindow from "./policy-chat-window";
import PolicyChatTrashDialog from "./policy-chat-trash-dialog";
import { useT } from "@/lib/i18n/client";

export default function PolicyChatWorkspace() {
  const t = useT().policyChat;
  const [activeDoc, setActiveDoc] = useState<PolicyDocument | null>(null);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showHistoryMobile, setShowHistoryMobile] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PolicyConversation | null>(null);

  const {
    documents,
    loading: docsLoading,
    error: docsError,
    refresh: refreshDocs,
    upload,
    remove: removeDoc,
  } = usePolicyDocuments();

  const {
    conversations,
    loading: convLoading,
    error: convError,
    refresh: refreshConvs,
    remove: removeConv,
    restore,
  } = usePolicyConversations(activeDoc?.id ?? null);

  const trash = usePolicyTrash(trashOpen);

  const setActiveConv = useCallback((id: string | null) => {
    setActiveConvId(id);
  }, []);

  const { messages, sendMessage, editMessage, streaming, loading } = usePolicyChat(
    activeDoc?.id ?? null,
    activeConvId,
    {
      onConversationCreated: (id) => {
        setActiveConv(id);
        void refreshConvs();
      },
      onActivity: () => void refreshConvs(),
      onNotFound: () => setActiveConv(null),
    }
  );

  function selectDoc(doc: PolicyDocument) {
    if (doc.id === activeDoc?.id) return;
    setActiveDoc(doc);
    setActiveConvId(null);
    setShowHistoryMobile(false);
  }

  function selectConversation(id: string) {
    setActiveConvId(id);
    setShowHistoryMobile(false);
  }

  function newChat() {
    setActiveConvId(null);
    setShowHistoryMobile(false);
  }

  async function handleUpload(file: File): Promise<boolean> {
    const doc = await upload(file);
    if (!doc) return false;
    setActiveDoc(doc);
    setActiveConvId(null);
    return true;
  }

  async function handleDeleteDoc(doc: PolicyDocument) {
    const ok = await removeDoc(doc.id);
    if (!ok) return;
    if (doc.id === activeDoc?.id) {
      setActiveDoc(null);
      setActiveConvId(null);
    }
    void refreshDocs();
  }

  async function confirmMoveConvToTrash(c: PolicyConversation) {
    const ok = await removeConv(c.id);
    if (!ok) {
      toast.error(t.deleteFailed);
      return;
    }
    if (c.id === activeConvId) setActiveConvId(null);
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

  const docSidebar = (
    <PolicyDocumentSidebar
      documents={documents}
      activeId={activeDoc?.id ?? null}
      loading={docsLoading}
      error={docsError}
      disabled={streaming}
      onSelect={selectDoc}
      onUpload={handleUpload}
      onDelete={(doc) => void handleDeleteDoc(doc)}
    />
  );

  const convSidebar = activeDoc ? (
    <PolicyChatHistorySidebar
      conversations={conversations}
      activeId={activeConvId}
      loading={convLoading}
      error={convError}
      disabled={streaming}
      onSelect={selectConversation}
      onNewChat={newChat}
      onDelete={(c) => setPendingDelete(c)}
      onOpenTrash={() => {
        setShowHistoryMobile(false);
        setTrashOpen(true);
      }}
    />
  ) : null;

  const chatArea = activeDoc ? (
    <PolicyChatWindow
      messages={messages}
      sendMessage={sendMessage}
      editMessage={editMessage}
      streaming={streaming}
      loading={loading}
    />
  ) : (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-muted-foreground">
      <FileTextIcon className="size-10" />
      <div>
        <p className="font-medium text-foreground">{t.noDocumentSelected}</p>
        <p className="text-sm">{t.noDocumentBody}</p>
      </div>
    </div>
  );

  return (
    <Card className="relative flex h-full flex-row gap-0 overflow-hidden py-0">
      {/* Document list column */}
      <aside className="hidden w-56 shrink-0 border-r bg-muted/20 md:block">{docSidebar}</aside>

      {/* Conversation history column */}
      {activeDoc && (
        <aside className="hidden w-60 shrink-0 border-r bg-muted/20 md:block">
          {convSidebar}
        </aside>
      )}

      {/* Mobile drawer */}
      {showHistoryMobile && (
        <div className="absolute inset-0 z-20 flex md:hidden">
          <aside className="flex w-80 max-w-[90%] border-r bg-card shadow-lg">
            <div className="w-48 shrink-0 border-r">{docSidebar}</div>
            {activeDoc && <div className="flex-1">{convSidebar}</div>}
          </aside>
          <button
            type="button"
            aria-label={t.closeHistory}
            className="flex-1 bg-black/30"
            onClick={() => setShowHistoryMobile(false)}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile topbar */}
        <div className="flex items-center gap-2 border-b px-3 py-2 md:hidden">
          <Button variant="ghost" size="sm" onClick={() => setShowHistoryMobile(true)}>
            <HistoryIcon />
            {t.history}
          </Button>
          {activeDoc && (
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
          )}
        </div>
        {chatArea}
      </div>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.deleteChatConfirmTitle}</DialogTitle>
            <DialogDescription>
              {pendingDelete ? t.deleteChatConfirmBody(pendingDelete.title) : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const c = pendingDelete;
                setPendingDelete(null);
                if (c) void confirmMoveConvToTrash(c);
              }}
            >
              {t.moveToBin}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PolicyChatTrashDialog
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
