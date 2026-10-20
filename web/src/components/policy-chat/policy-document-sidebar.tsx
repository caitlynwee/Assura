"use client";

import { useState } from "react";
import { FileTextIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PolicyDocument } from "@/lib/types";
import { useT } from "@/lib/i18n/client";
import PolicyUploadDialog from "./policy-upload-dialog";

interface Props {
  documents: PolicyDocument[];
  activeId: string | null;
  loading: boolean;
  error: string | null;
  disabled?: boolean;
  onSelect: (doc: PolicyDocument) => void;
  onUpload: (file: File) => Promise<boolean>;
  onDelete: (doc: PolicyDocument) => void;
}

export default function PolicyDocumentSidebar({
  documents,
  activeId,
  loading,
  error,
  disabled,
  onSelect,
  onUpload,
  onDelete,
}: Props) {
  const t = useT().policyChat;
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => setUploadOpen(true)}
          disabled={disabled}
        >
          <PlusIcon />
          {t.uploadButton}
        </Button>
      </div>

      <nav aria-label={t.documentList} className="flex-1 overflow-y-auto px-2 pb-3">
        {loading && (
          <div className="space-y-2 px-1 pt-1">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-5/6" />
          </div>
        )}
        {!loading && error && (
          <p className="px-2 pt-1 text-sm text-destructive">{error}</p>
        )}
        {!loading && !error && documents.length === 0 && (
          <p className="px-2 pt-1 text-sm text-muted-foreground">{t.noDocuments}</p>
        )}
        {!loading && (
          <ul className="space-y-0.5">
            {documents.map((doc) => {
              const active = doc.id === activeId;
              return (
                <li key={doc.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(doc)}
                    disabled={disabled}
                    aria-current={active ? "page" : undefined}
                    title={doc.title}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md py-2 pl-2 pr-9 text-left text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground disabled:opacity-60",
                      active && "bg-accent font-medium text-accent-foreground"
                    )}
                  >
                    <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{doc.title}</p>
                      {doc.extractedText === null && (
                        <p className="truncate text-xs text-muted-foreground">{t.extracting}</p>
                      )}
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t.deleteDocument}
                    title={t.deleteDocument}
                    onClick={() => onDelete(doc)}
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
        )}
      </nav>

      <PolicyUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUpload={onUpload}
      />
    </div>
  );
}
