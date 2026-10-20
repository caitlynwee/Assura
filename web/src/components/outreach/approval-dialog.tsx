"use client";

/**
 * Final confirmation before an email is queued in Mailpit (policy tier 2: SEND
 * requires explicit user approval). Jeff: extend freely — the wizard only
 * relies on the props below.
 */

import { CheckIcon, SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AI_DISCLOSURE_FOOTER } from "@/lib/constants";
import { useT } from "@/lib/i18n/client";

export interface ApprovalItem {
  insurerName: string;
  to: string;
  subject: string;
}

interface Props {
  open: boolean;
  from: string;
  items: ApprovalItem[];
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ApprovalDialog({
  open,
  from,
  items,
  onCancel,
  onConfirm,
}: Props) {
  const tt = useT();
  const t = tt.outreach.dialog;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t.title(items.length)}
          </DialogTitle>
          <DialogDescription>
            {t.sentFrom}{" "}
            <span className="font-mono text-foreground">{from}</span>
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border">
          {items.map((i) => (
            <li key={i.to} className="px-3 py-2 text-sm">
              <p className="font-medium">{i.insurerName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {i.to} · {i.subject}
              </p>
            </li>
          ))}
        </ul>

        <ul className="space-y-1.5 text-xs text-muted-foreground">
          {t.safeguards(AI_DISCLOSURE_FOOTER).map((s) => (
            <li key={s} className="flex gap-2">
              <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
              {s}
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t.backToEdit}
          </Button>
          <Button autoFocus onClick={onConfirm}>
            <SendIcon />
            {t.approveSend}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
