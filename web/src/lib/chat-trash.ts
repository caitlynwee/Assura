/**
 * chat-trash.ts — 30-day retention for "Recently deleted" Plan Q&A chats.
 *
 * There is no web-side scheduler, so expiry is enforced lazily: every time a
 * chat list or the bin is loaded, anything binned more than
 * TRASH_RETENTION_DAYS ago is permanently deleted first (for all users). An
 * expired chat therefore can never be seen or restored, and is physically
 * removed on the next visit to the chat page by anyone.
 */

import { TRASH_RETENTION_DAYS } from "./constants";
import { purgeExpiredConversations } from "./db";
import { logEvent } from "./audit";

const DAY_MS = 24 * 60 * 60 * 1000;

export function trashCutoff(now = Date.now()): string {
  return new Date(now - TRASH_RETENTION_DAYS * DAY_MS).toISOString();
}

/** When a chat binned at `deletedAt` will be permanently removed. */
export function purgeDate(deletedAt: string): string {
  return new Date(new Date(deletedAt).getTime() + TRASH_RETENTION_DAYS * DAY_MS).toISOString();
}

export async function purgeExpiredChats(): Promise<void> {
  const count = await purgeExpiredConversations(trashCutoff());
  if (count > 0) {
    void logEvent("system", "chat.trash_auto_purged", {
      count,
      retentionDays: TRASH_RETENTION_DAYS,
    }).catch(() => {});
  }
}
