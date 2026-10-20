"use client";

/**
 * DeleteAccountDialog — self-service permanent account deletion.
 *
 * Guards against accidents: the user must type DELETE to enable the button.
 * Submits the `deleteAccountAction` server action, which removes the app data
 * (threads/messages/users row), deletes the Supabase identity, signs out, and
 * redirects home with a toast.
 */

import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import { deleteAccountAction } from "@/app/_actions/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/client";

export default function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [confirm, setConfirm] = useState("");
  const armed = confirm.trim().toUpperCase() === "DELETE";
  const tt = useT();
  const t = tt.account.deleteDialog;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.desc}</DialogDescription>
        </DialogHeader>

        <form action={deleteAccountAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="confirm-delete">
              {t.typeBefore} <span className="font-mono font-semibold">{t.confirmWord}</span> {t.typeAfter}
            </Label>
            <Input
              id="confirm-delete"
              name="confirm"
              autoComplete="off"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="DELETE"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tt.common.cancel}
            </Button>
            <Button type="submit" variant="destructive" disabled={!armed}>
              <Trash2Icon />
              {t.confirmButton}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
