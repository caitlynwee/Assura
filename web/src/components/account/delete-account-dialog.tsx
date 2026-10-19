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

export default function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [confirm, setConfirm] = useState("");
  const armed = confirm.trim().toUpperCase() === "DELETE";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account</DialogTitle>
          <DialogDescription>
            This permanently deletes your account, your outreach threads, and all
            extracted quotes. It cannot be undone. Your audit log entries are kept
            (append-only) for integrity.
          </DialogDescription>
        </DialogHeader>

        <form action={deleteAccountAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="confirm-delete">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm
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
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!armed}>
              <Trash2Icon />
              Delete account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
