/**
 * policy-chat-trash.ts — 30-day retention for "Recently deleted" Policy Chat conversations.
 * Mirrors chat-trash.ts exactly but targets policy_conversations.
 */

import { TRASH_RETENTION_DAYS } from "./constants";
import { purgeExpiredPolicyConversations } from "./db";
import { logEvent } from "./audit";

const DAY_MS = 24 * 60 * 60 * 1000;

export function policyTrashCutoff(now = Date.now()): string {
  return new Date(now - TRASH_RETENTION_DAYS * DAY_MS).toISOString();
}

export function policyPurgeDate(deletedAt: string): string {
  return new Date(new Date(deletedAt).getTime() + TRASH_RETENTION_DAYS * DAY_MS).toISOString();
}

export async function purgeExpiredPolicyChats(): Promise<void> {
  const count = await purgeExpiredPolicyConversations(policyTrashCutoff());
  if (count > 0) {
    void logEvent("system", "policy_chat.trash_auto_purged", {
      count,
      retentionDays: TRASH_RETENTION_DAYS,
    }).catch(() => {});
  }
}
