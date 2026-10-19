"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Thread } from "@/lib/types";

interface PollOptions {
  /** How many times to re-fetch before giving up. */
  attempts?: number;
  /** Delay between attempts, in milliseconds. */
  intervalMs?: number;
}

const DEFAULT_POLL: Required<PollOptions> = { attempts: 5, intervalMs: 1500 };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function signature(thread: Thread | null): string {
  if (!thread) return "none";
  return `${thread.status}:${thread.messages.length}`;
}

export function useThread(threadId: string) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  // Mirror the latest thread into a ref so pollUntilChanged can read the
  // current value without being re-created on every render. The ref is only
  // written inside effects/callbacks, never during render.
  const threadRef = useRef<Thread | null>(null);
  useEffect(() => {
    threadRef.current = thread;
  }, [thread]);

  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    fetch(`/api/crm/threads/${threadId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setThread(d.thread ?? null);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load thread.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  /** Fetch the thread once and update state. Returns the fetched thread (or null). */
  const refresh = useCallback(async (): Promise<Thread | null> => {
    try {
      const res = await fetch(`/api/crm/threads/${threadId}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.thread) {
        setThread(data.thread);
        return data.thread as Thread;
      }
      return null;
    } catch {
      return null;
    }
  }, [threadId]);

  /**
   * Poll the thread a few times, stopping early once its status or message
   * count changes from the current value. Resolves to true if a change was
   * detected, false if the thread was unchanged after every attempt (expected
   * for the 'slow' persona, which only replies after a follow-up).
   */
  const pollUntilChanged = useCallback(
    async (options?: PollOptions): Promise<boolean> => {
      const { attempts, intervalMs } = { ...DEFAULT_POLL, ...options };
      const baseline = signature(threadRef.current);
      setPolling(true);
      try {
        for (let i = 0; i < attempts; i++) {
          await sleep(intervalMs);
          const fetched = await refresh();
          if (fetched && signature(fetched) !== baseline) {
            return true;
          }
        }
        return false;
      } finally {
        setPolling(false);
      }
    },
    [refresh]
  );

  return { thread, loading, error, polling, setThread, refresh, pollUntilChanged };
}
