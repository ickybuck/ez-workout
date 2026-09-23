import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { LogRow } from './templateBundleExport';

/**
 * A stand-in for the PostgREST query builder, holding the one behaviour this
 * file is about: a request returns at most `max-rows` rows and says nothing
 * about the ones it left behind.
 *
 * The client is mocked rather than imported because `supabase.ts` throws at
 * import time when the environment has no keys, and none of this needs a real
 * one.
 */
const state = vi.hoisted(() => ({
  rows: [] as unknown[],
  maxRows: 1000,
  ranges: [] as Array<[number, number]>,
}));

vi.mock('./supabase', () => {
  const builder = {
    select: () => builder,
    gte: () => builder,
    order: () => builder,
    range: (from: number, to: number) => {
      state.ranges.push([from, to]);
      const size = Math.min(to - from + 1, state.maxRows);
      return Promise.resolve({ data: state.rows.slice(from, from + size), error: null });
    },
  };
  return { supabase: { from: () => builder } };
});

const { fetchPerformanceSummary, summarisePerformance } = await import('./templateBundleExport');

const USER = 'user-1';

/** One finished set, owned by USER unless said otherwise. */
const log = (
  overrides: Partial<{
    name: string;
    weight: number;
    reps: number;
    failed: number;
    at: string;
    userId: string;
    finished: boolean;
  }> = {},
): LogRow => {
  const {
    name = 'Squats',
    weight = 100,
    reps = 10,
    failed = 0,
    at = '2026-01-01T00:00:00.000Z',
    userId = USER,
    finished = true,
  } = overrides;

  return {
    weight,
    reps,
    failed_reps: failed,
    created_at: at,
    workout_exercise: {
      exercise: { name },
      workout: { user_id: userId, end_time: finished ? at : null },
    },
  };
};

beforeEach(() => {
  state.rows = [];
  state.maxRows = 1000;
  state.ranges = [];
});

describe('summarisePerformance', () => {
  it('takes the last row as the recent one, and the largest as the best', () => {
    const rows = [
      log({ weight: 100, reps: 10, at: '2026-01-01T00:00:00.000Z' }),
      log({ weight: 140, reps: 5, at: '2026-02-01T00:00:00.000Z' }),
      log({ weight: 120, reps: 8, at: '2026-03-01T00:00:00.000Z' }),
    ];

    const [squats] = summarisePerformance(rows, USER, 'kg');
    expect(squats.recent_weight).toBe(120);
    expect(squats.recent_reps).toBe(8);
    expect(squats.best_weight).toBe(140);
    expect(squats.last_performed).toBe('2026-03-01T00:00:00.000Z');
  });

  it('counts sessions by distinct day, not by set', () => {
    const rows = [
      log({ at: '2026-01-01T10:00:00.000Z' }),
      log({ at: '2026-01-01T10:05:00.000Z' }),
      log({ at: '2026-01-03T10:00:00.000Z' }),
    ];
    expect(summarisePerformance(rows, USER, 'kg')[0].sessions).toBe(2);
  });

  it('ignores abandoned workouts and other people rows', () => {
    const rows = [
      log({ name: 'Squats' }),
      log({ name: 'Bench Press', finished: false }),
      log({ name: 'Deadlift', userId: 'someone-else' }),
    ];
    expect(summarisePerformance(rows, USER, 'kg').map((s) => s.exercise_name)).toEqual(['Squats']);
  });

  it('reports failed reps as a share of what was prescribed', () => {
    const rows = [log({ reps: 8, failed: 2 })];
    expect(summarisePerformance(rows, USER, 'kg')[0].failed_rep_rate).toBeCloseTo(0.2, 5);
  });
});

describe('fetchPerformanceSummary paging', () => {
  it('reads past the 1,000-row cap and lets the newest set win', async () => {
    // EZ-35 in one test. The export read the oldest 1,000 rows of a larger
    // window and called the last of them "recent": Squats came back at 275 lb
    // from June while the real last session was 295 lb in September.
    state.rows = [
      ...Array.from({ length: 1000 }, (_, i) =>
        log({ weight: 125, reps: 10, at: `2026-06-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z` }),
      ),
      ...Array.from({ length: 500 }, (_, i) =>
        log({ weight: 130, reps: 8, at: `2026-09-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z` }),
      ),
      log({ weight: 134, reps: 10, at: '2026-09-22T00:00:00.000Z' }),
    ];

    const [squats] = await fetchPerformanceSummary(USER, 'kg');

    expect(squats.recent_weight).toBe(134);
    expect(squats.last_performed).toBe('2026-09-22T00:00:00.000Z');
    // Without paging the caller saw one request and 1,000 rows.
    expect(state.ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it('stops after a short page rather than asking forever', async () => {
    state.rows = Array.from({ length: 10 }, () => log());
    await fetchPerformanceSummary(USER, 'kg');
    expect(state.ranges).toEqual([[0, 999]]);
  });

  it('stops when the last page is exactly full and the next is empty', async () => {
    // The boundary that loops forever if the exit test is written as
    // "stop when a page comes back empty" but the rows happen to divide evenly.
    state.rows = Array.from({ length: 2000 }, () => log());
    await fetchPerformanceSummary(USER, 'kg');
    expect(state.ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });
});
