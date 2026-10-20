"use client";

import { useState } from "react";
import { MessageSquareIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TrashedPolicyConversation } from "@/hooks/use-policy-conversations";
import { useLocale, useT } from "@/lib/i18n/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: TrashedPolicyConversation[];
  retentionDays: number;
  loading: boolean;
  error: string | null;
  onRestore: (id: string) => Promise<boolean>;
  onDeleteForever: (id: string) => Promise<boolean>;
  onEmpty: () => Promise<boolean>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysLeft(purgeAt: string): number {
  return Math.max(0, Math.ceil((new Date(purgeAt).getTime() - Date.now()) / DAY_MS));
}

function deletedLabel(deletedAt: string, intlLocale: string): string {
  return new Date(deletedAt).toLocaleDateString(intlLocale, {
    day: "numeric",
    month: "short",
  });
}

export default function PolicyChatTrashDialog({
  open,
  onOpenChange,
  items,
  retentionDays,
  loading,
  error,
  onRestore,
  onDeleteForever,
  onEmpty,
}: Props) {
  const [confirming, setConfirming] = useState<string | "all" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const tt = useT();
  const t = tt.policyChat.bin;
  const { intlLocale } = useLocale();

  async function run(key: string, action: () => Promise<boolean>, failMsg: string) {
    setBusy(key);
    setActionError(null);
    const ok = await action();
    setBusy(null);
    setConfirming(null);
    if (!ok) setActionError(failMsg);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setConfirming(null);
        setActionError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tt.policyChat.recentlyDeleted}</DialogTitle>
          <DialogDescription>{t.description(retentionDays)}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] min-h-24 overflow-y-auto">
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}
          {!loading && error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t.empty}</p>
          )}
          {!loading && !error && items.length > 0 && (
            <ul className="divide-y rounded-md border">
              {items.map((c) => {
                const left = daysLeft(c.purgeAt);
                const isConfirming = confirming === c.id;
                return (
                  <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                    <MessageSquareIcon className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={c.title}>
                        {c.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isConfirming
                          ? t.confirmForever
                          : `${t.deletedOn(deletedLabel(c.deletedAt!, intlLocale))} · ${
                              left <= 1 ? t.removedSoon : t.daysLeft(left)
                            }`}
                      </p>
                    </div>
                    {isConfirming ? (
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirming(null)}
                          disabled={busy !== null}
                        >
                          {tt.common.cancel}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() =>
                            run(c.id, () => onDeleteForever(c.id), t.deleteOneFailed)
                          }
                        >
                          {busy === c.id ? tt.common.deleting : tt.common.delete}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() =>
                            run(`restore-${c.id}`, () => onRestore(c.id), t.restoreOneFailed)
                          }
                        >
                          <RotateCcwIcon />
                          {busy === `restore-${c.id}` ? t.restoring : t.restore}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          aria-label={t.deleteForeverLabel(c.title)}
                          title={t.deleteForever}
                          disabled={busy !== null}
                          onClick={() => setConfirming(c.id)}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {actionError && <p className="text-sm text-destructive">{actionError}</p>}

        <DialogFooter className="sm:justify-between">
          {confirming === "all" ? (
            <>
              <p className="self-center text-sm text-destructive">
                {t.confirmEmpty(items.length)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setConfirming(null)}
                  disabled={busy !== null}
                >
                  {tt.common.cancel}
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy !== null}
                  onClick={() => run("all", onEmpty, t.emptyFailed)}
                >
                  {busy === "all" ? t.emptying : t.emptyBin}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirming("all")}
                disabled={loading || items.length === 0 || busy !== null}
              >
                <Trash2Icon />
                {t.emptyBin}
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy !== null}
              >
                {tt.common.close}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
