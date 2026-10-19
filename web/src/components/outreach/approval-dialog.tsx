"use client";

/**
 * Final confirmation before any email leaves Assura (policy tier 2: SEND
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
import { AI_DISCLOSURE_PREFIX } from "@/lib/constants";

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

const SAFEGUARDS = [
  `Each email opens with an AI disclosure: “${AI_DISCLOSURE_PREFIX.slice(0, 60)}…”`,
  "Scanned for NRIC, phone, health and income data before sending",
  "Assura never agrees to buy or books calls on your behalf",
  "Recorded in your tamper-evident activity log",
];

export default function ApprovalDialog({ open, from, items, onCancel, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Approve and send {items.length} email{items.length === 1 ? "" : "s"}?
          </DialogTitle>
          <DialogDescription>
            Sent from your masked inbox <span className="font-mono text-foreground">{from}</span>
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
          {SAFEGUARDS.map((s) => (
            <li key={s} className="flex gap-2">
              <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
              {s}
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Back to edit
          </Button>
          <Button autoFocus onClick={onConfirm}>
            <SendIcon />
            Approve &amp; send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
