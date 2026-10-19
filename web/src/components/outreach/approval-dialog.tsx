"use client";

/**
 * Final confirmation before any email leaves Assura (policy tier 2: SEND
 * requires explicit user approval). Jeff: extend freely — the wizard only
 * relies on the props below.
 */

import { useEffect } from "react";
import Button from "@/components/ui/button";
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

export default function ApprovalDialog({ open, from, items, onCancel, onConfirm }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="approve-title"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 id="approve-title" className="text-lg font-semibold text-gray-900">
          Approve and send {items.length} email{items.length === 1 ? "" : "s"}?
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Sent from your masked inbox <span className="font-mono text-gray-700">{from}</span>
        </p>

        <ul className="mt-4 max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200">
          {items.map((i) => (
            <li key={i.to} className="px-3 py-2 text-sm">
              <p className="font-medium text-gray-900">{i.insurerName}</p>
              <p className="truncate text-xs text-gray-500">
                {i.to} · {i.subject}
              </p>
            </li>
          ))}
        </ul>

        <ul className="mt-4 space-y-1 text-xs text-gray-600">
          <li>✓ Each email opens with an AI disclosure: “{AI_DISCLOSURE_PREFIX.slice(0, 60)}…”</li>
          <li>✓ Scanned for NRIC, phone, health and income data before sending</li>
          <li>✓ Assura never agrees to buy or books calls on your behalf</li>
          <li>✓ Recorded in your tamper-evident activity log</li>
        </ul>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Back to edit
          </Button>
          <Button autoFocus onClick={onConfirm}>
            Approve &amp; send
          </Button>
        </div>
      </div>
    </div>
  );
}
