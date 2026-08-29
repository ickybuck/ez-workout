import { describe, it, expect, vi } from 'vitest';
import {
  coalesce,
  keyFor,
  inFlushOrder,
  createMutationQueue,
  localStorageAdapter,
  MAX_ATTEMPTS,
  type QueuedMutation,
} from './mutationQueue';

/** A queue wired to controllable fakes, so no test depends on real time or network. */
function harness({
  online = true,
  fail = 0,
  initial = [] as QueuedMutation[],
} = {}) {
  let clock = 1000;
  let stored = initial;
  let remaining = fail;
  const executed: QueuedMutation[] = [];
  const abandoned: QueuedMutation[] = [];

  const queue = createMutationQueue({
    execute: async (m) => {
      if (remaining > 0) {
        remaining -= 1;
        throw new Error('network');
      }
      executed.push(m);
    },
    load: () => stored,
    save: (p) => {
      stored = p;
    },
    now: () => (clock += 1),
    isOnline: () => online,
    onAbandoned: (m) => abandoned.push(m),
  });

  return {
    queue,
    executed,
    abandoned,
    stored: () => stored,
    goOnline: () => {
      online = true;
    },
    goOffline: () => {
      online = false;
    },
  };
}

const set = (rowId: string, values: Record<string, unknown>) => ({
  table: 'exercise_logs',
  rowId,
  values,
});

describe('coalescing', () => {
  it('merges repeated edits to the same row into one entry', () => {
    let pending = coalesce([], set('log-1', { completed: true }), 1);
    pending = coalesce(pending, set('log-1', { completed: false }), 2);
    pending = coalesce(pending, set('log-1', { completed: true, failed_reps: 2 }), 3);

    expect(pending).toHaveLength(1);
    expect(pending[0].values).toEqual({ completed: true, failed_reps: 2 });
  });

  it('keeps rows independent', () => {
    let pending = coalesce([], set('log-1', { completed: true }), 1);
    pending = coalesce(pending, set('log-2', { completed: true }), 2);
    expect(pending).toHaveLength(2);
  });

  it('preserves the original queue time when merging', () => {
    // Otherwise a repeatedly-edited row keeps resetting its age and can
    // starve older writes once flushing is oldest-first.
    let pending = coalesce([], set('log-1', { completed: true }), 100);
    pending = coalesce(pending, set('log-1', { reps: 8 }), 500);
    expect(pending[0].queuedAt).toBe(100);
  });

  it('resets attempts when new values arrive', () => {
    const stale: QueuedMutation[] = [
      { ...set('log-1', { completed: true }), key: keyFor(set('log-1', {})), queuedAt: 1, attempts: 3 },
    ];
    expect(coalesce(stale, set('log-1', { reps: 5 }), 2)[0].attempts).toBe(0);
  });
});

describe('flush ordering', () => {
  it('is oldest first', () => {
    const mk = (rowId: string, queuedAt: number): QueuedMutation => ({
      ...set(rowId, {}),
      key: `exercise_logs:${rowId}`,
      queuedAt,
      attempts: 0,
    });
    expect(inFlushOrder([mk('c', 30), mk('a', 10), mk('b', 20)]).map((m) => m.rowId))
      .toEqual(['a', 'b', 'c']);
  });
});

describe('offline behaviour', () => {
  it('accepts writes while offline without throwing', async () => {
    const h = harness({ online: false });
    h.queue.enqueue(set('log-1', { completed: true }));
    h.queue.enqueue(set('log-2', { completed: true }));

    expect(h.queue.size()).toBe(2);
    expect(h.executed).toHaveLength(0);
  });

  it('flushes everything once back online', async () => {
    const h = harness({ online: false });
    h.queue.enqueue(set('log-1', { completed: true }));
    h.queue.enqueue(set('log-2', { completed: true }));

    h.goOnline();
    await h.queue.flush();

    expect(h.executed.map((m) => m.rowId)).toEqual(['log-1', 'log-2']);
    expect(h.queue.size()).toBe(0);
  });

  it('sends one write for a set completed, undone and completed again', async () => {
    // The scenario that motivated coalescing: without it this replays three
    // writes and the final state depends on flush order.
    const h = harness({ online: false });
    h.queue.enqueue(set('log-1', { completed: true, failed_reps: 0 }));
    h.queue.enqueue(set('log-1', { completed: false, failed_reps: 0 }));
    h.queue.enqueue(set('log-1', { completed: true, failed_reps: 3 }));

    h.goOnline();
    await h.queue.flush();

    expect(h.executed).toHaveLength(1);
    expect(h.executed[0].values).toEqual({ completed: true, failed_reps: 3 });
  });

  it('survives a reload while offline', async () => {
    const first = harness({ online: false });
    first.queue.enqueue(set('log-1', { completed: true }));
    const persisted = first.stored();

    // New session, same storage — the queue is rebuilt from what was saved.
    const second = harness({ online: true, initial: persisted });
    await second.queue.flush();

    expect(second.executed.map((m) => m.rowId)).toEqual(['log-1']);
  });
});

describe('retry and failure', () => {
  it('keeps a failed write queued and retries it', async () => {
    const h = harness({ fail: 1 });
    h.queue.enqueue(set('log-1', { completed: true }));
    await h.queue.flush();
    expect(h.queue.size()).toBe(1);

    await h.queue.flush();
    expect(h.executed).toHaveLength(1);
    expect(h.queue.size()).toBe(0);
  });

  it('abandons and reports an entry that keeps failing', async () => {
    // A permanently-invalid write must not block everything behind it.
    const h = harness({ fail: Number.MAX_SAFE_INTEGER });
    h.queue.enqueue(set('log-1', { completed: true }));

    for (let i = 0; i < MAX_ATTEMPTS; i++) await h.queue.flush();

    expect(h.queue.size()).toBe(0);
    expect(h.abandoned.map((m) => m.rowId)).toEqual(['log-1']);
  });

  it('does not flush concurrently', async () => {
    const h = harness({ online: true });
    h.queue.enqueue(set('log-1', { completed: true }));
    await Promise.all([h.queue.flush(), h.queue.flush(), h.queue.flush()]);
    expect(h.executed).toHaveLength(1);
  });
});

describe('subscribe', () => {
  it('notifies on enqueue and on flush, so the UI can show pending writes', async () => {
    const h = harness({ online: false });
    const seen: number[] = [];
    h.queue.subscribe(() => seen.push(h.queue.size()));

    h.queue.enqueue(set('log-1', { completed: true }));
    h.queue.enqueue(set('log-2', { completed: true }));
    h.goOnline();
    await h.queue.flush();

    expect(seen[0]).toBe(1);
    expect(seen[1]).toBe(2);
    expect(seen[seen.length - 1]).toBe(0);
  });

  it('stops notifying after unsubscribe', () => {
    const h = harness({ online: false });
    let calls = 0;
    const off = h.queue.subscribe(() => {
      calls += 1;
    });

    h.queue.enqueue(set('log-1', { completed: true }));
    off();
    h.queue.enqueue(set('log-2', { completed: true }));

    expect(calls).toBe(1);
  });
});

describe('localStorage adapter', () => {
  it('returns an empty queue when storage is corrupt', () => {
    const store: Record<string, string> = { 'test-queue': '{not json' };
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    });
    // Losing the queue is bad; failing to start the app is worse.
    expect(localStorageAdapter('test-queue').load()).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('does not throw when storage rejects a write', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    expect(() => localStorageAdapter('test-queue').save([])).not.toThrow();
    vi.unstubAllGlobals();
  });
});
