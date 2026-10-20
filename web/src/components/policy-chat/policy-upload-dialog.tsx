"use client";

import { useRef, useState } from "react";
import { UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/client";
import { MAX_POLICY_DOCUMENT_BYTES } from "@/lib/constants";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File) => Promise<boolean>;
}

export default function PolicyUploadDialog({ open, onOpenChange, onUpload }: Props) {
  const t = useT().policyChat;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleClose() {
    if (busy) return;
    setError(null);
    onOpenChange(false);
  }

  async function handleFile(file: File) {
    setError(null);
    if (file.type !== "application/pdf") {
      setError(t.uploadTypeError);
      return;
    }
    if (file.size > MAX_POLICY_DOCUMENT_BYTES) {
      setError(t.uploadSizeError);
      return;
    }
    setBusy(true);
    const ok = await onUpload(file);
    setBusy(false);
    if (ok) {
      onOpenChange(false);
    } else {
      setError(t.uploadError);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    // Reset so the same file can be re-selected after an error.
    e.target.value = "";
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.uploadButton}</DialogTitle>
          <DialogDescription>{t.uploadSizeError.replace("File", "PDFs up to 10 MB")}</DialogDescription>
        </DialogHeader>

        <div
          className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed py-10 text-center text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label={t.uploadButton}
        >
          <UploadIcon className="size-8" />
          <p className="text-sm font-medium">{t.uploadButton}</p>
          <p className="text-xs">PDF · max 10 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleChange}
            disabled={busy}
          />
        </div>

        {busy && <p className="text-center text-sm text-muted-foreground">{t.uploading}</p>}
        {error && <p className="text-center text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
