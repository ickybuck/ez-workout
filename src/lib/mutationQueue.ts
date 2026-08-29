/**
 * A durable, offline-tolerant queue for row updates.
 *
 * The problem it solves: logging a set awaited a Supabase write and only then
 * updated local state, so a dropped connection lost the entry outright. The
 * active workout was persisted through zustand, but only ever *after* a
 * successful round trip — so there was nothing to reconcile later. In a gym,
 * on the app's single most important interaction, that is the wrong order.
 *
 * The inversion: apply locally first, enqueue the write, flush when the
 * network allows.
 *
 * Two properties make replay safe, and both depend on this queue only ever
 * carrying updates to rows that already exist:
 *
 *  - **Idempotent.** Every entry is "set these columns on this row" against a
 *    server-generated id. Replaying it is harmless; the last write wins.
 *  - **Coalescing.** Repeated edits to the same row merge into one entry
 *    rather than queueing a replay of every intermediate state. Complete a
 *    set, undo it, complete it again while offline, and one write goes out
 *    carrying the final state — not three, ending in whatever order they
 *    happened to flush.
 *
 * Inserts are deliberately not supported. Starting a workout needs three
 * dependent inserts whose ids come from the server (see EZ-12), which is a
 * different problem and needs client-generated uuids to solve.
 */

export interface Mutation {
  table: string;
  rowId: string;
  values: Record<string, unknown>;
}

export interface QueuedMutation extends Mutation {
  /** Stable identity for coalescing: one entry per row. */
  key: string;
  queuedAt: number;
  attempts: number;
}

/** Entries are per row, so two edits to the same row merge. */
export function keyFor(m: Mutation): string {
  return `${m.table}:${m.rowId}`;
}

/**
 * Add a mutation, merging into an existing entry for the same row.
 *
 * The merged entry keeps the ORIGINAL queuedAt, so an endlessly-edited row
 * cannot starve older writes once ordering is by age, and resets attempts,
 * since new values deserve a fresh try even if the previous ones failed.
 */
export function coalesce(pending: QueuedMutation[], m: Mutation, now: number): QueuedMutation[] {
  const key = keyFor(m);
  const existing = pending.find((p) => p.key === key);

  if (!existing) {
    return [...pending, { ...m, key, queuedAt: now, attempts: 0 }];
  }

  return pending.map((p) =>
    p.key === key
      ? { ...p, values: { ...p.values, ...m.values }, attempts: 0 }
      : p,
  );
}

/** Oldest first, so a long offline stretch flushes in the order it happened. */
export function inFlushOrder(pending: QueuedMutation[]): QueuedMutation[] {
  return [...pending].sort((a, b) => a.queuedAt - b.queuedAt);
}

export interface QueueDeps {
  /** Perform one write. Reject to keep the entry queued. */
  execute: (m: QueuedMutation) => Promise<void>;
  /** Injectable for tests; defaults to localStorage in createMutationQueue. */
  load: () => QueuedMutation[];
  save: (pending: QueuedMutation[]) => void;
  now: () => number;
  isOnline: () => boolean;
  /**
   * Called when an entry is abandoned after maxAttempts. The write is gone —
   * surface it rather than dropping it silently, which is the failure mode
   * this whole queue exists to stop repeating.
   */
  onAbandoned?: (m: QueuedMutation, error: unknown) => void;
}

export const MAX_ATTEMPTS = 5;

export function createMutationQueue(deps: QueueDeps) {
  let pending: QueuedMutation[] = deps.load();
  let flushing = false;
  const listeners = new Set<() => void>();

  const persist = () => {
    deps.save(pending);
    listeners.forEach((l) => l());
  };

  /** Apply-locally-first callers use this: it never throws and never blocks. */
  function enqueue(m: Mutation): void {
    pending = coalesce(pending, m, deps.now());
    persist();
    void flush();
  }

  /**
   * Attempt every pending write. Failures stay queued and are retried on the
   * next flush; an entry that fails MAX_ATTEMPTS times is abandoned and
   * reported, because retrying a permanently-invalid write forever would
   * block everything behind it.
   */
  async function flush(): Promise<void> {
    if (flushing || !deps.isOnline() || pending.length === 0) return;
    flushing = true;

    try {
      for (const entry of inFlushOrder(pending)) {
        // Re-read: a concurrent enqueue may have merged newer values in.
        const current = pending.find((p) => p.key === entry.key);
        if (!current) continue;

        try {
          await deps.execute(current);
          pending = pending.filter((p) => p.key !== current.key);
        } catch (error) {
          const attempts = current.attempts + 1;
          if (attempts >= MAX_ATTEMPTS) {
            pending = pending.filter((p) => p.key !== current.key);
            deps.onAbandoned?.(current, error);
          } else {
            pending = pending.map((p) =>
              p.key === current.key ? { ...p, attempts } : p,
            );
          }
        }
        persist();
      }
    } finally {
      flushing = false;
    }
  }

  /**
   * Notified whenever the queue changes, so the UI can show that writes are
   * still in flight. Without this an offline user finishes a workout, sees it
   * missing from History, and reasonably concludes it was lost.
   */
  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    enqueue,
    flush,
    subscribe,
    /** Copy, so callers cannot mutate queue state by reference. */
    pending: () => [...pending],
    size: () => pending.length,
  };
}

export const STORAGE_KEY = 'workout-mutation-queue';

/** localStorage-backed load/save that survives absent or corrupt state. */
export function localStorageAdapter(storageKey = STORAGE_KEY) {
  return {
    load(): QueuedMutation[] {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        // Corrupt state must not brick logging. Losing the queue is bad;
        // being unable to start the app is worse.
        return [];
      }
    },
    save(pending: QueuedMutation[]) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(pending));
      } catch {
        // Quota or private-mode failure. The in-memory queue still works for
        // this session, so degrade rather than throw.
      }
    },
  };
}
