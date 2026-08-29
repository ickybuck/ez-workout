import { describe, it, expect } from 'vitest';
import { detectCleanStall, describeCleanStall, MIN_SESSIONS, type ExerciseSession } from './cleanStall';
import type { SetLike } from './stopReason';

const set = (over: Partial<SetLike> = {}): SetLike => ({ reps: 10, failed_reps: 0, ...over });

/** A clean session at a given weight, newest-first callers build arrays of these. */
const session = (date: string, weight: number, sets: SetLike[] = [set(), set(), set()]): ExerciseSession => ({
  date,
  topSetWeight: weight,
  sets,
});

/** n clean sessions at the same weight, newest first. */
const runOf = (n: number, weight = 125, sets?: SetLike[]) =>
  Array.from({ length: n }, (_, i) => session(`2026-08-${28 - i}`, weight, sets && sets.map((s) => ({ ...s }))));

describe('detecting a clean stall', () => {
  it('finds a run of clean sessions at an unchanged load', () => {
    const stall = detectCleanStall(runOf(5));
    expect(stall?.sessions).toBe(5);
    expect(stall?.weight).toBe(125);
  });

  it('says nothing below the minimum run', () => {
    expect(detectCleanStall(runOf(MIN_SESSIONS - 1))).toBeNull();
  });

  it('stops counting where the load last changed', () => {
    // Four sessions at 125 preceded by heavier work: the stall is four long,
    // not seven, because the run is what has not moved.
    const sessions = [...runOf(4, 125), ...runOf(3, 120)];
    expect(detectCleanStall(sessions)?.sessions).toBe(4);
  });

  it('ignores floating-point drift in the stored weight', () => {
    // 275 lb round-tripped through kilograms will not compare equal.
    const sessions = [
      session('2026-08-28', 124.73824),
      session('2026-08-20', 124.73825),
      session('2026-08-12', 124.73823),
    ];
    expect(detectCleanStall(sessions)?.sessions).toBe(3);
  });
});

describe('what disqualifies a session', () => {
  it('a partial set means the lift was troubled, so there is no stall', () => {
    const sessions = runOf(4);
    sessions[0] = session('2026-08-28', 125, [set(), set({ failed_reps: 3 }), set()]);
    expect(detectCleanStall(sessions)).toBeNull();
  });

  it('a skipped set does not count as clean', () => {
    // An exercise nobody performed is not evidence the weight was light.
    const sessions = runOf(4);
    sessions[1] = session('2026-08-20', 125, [set(), set({ failed_reps: 10 }), set()]);
    // The run stops at the skipped session, leaving one clean session -- below
    // the minimum, so nothing is claimed.
    expect(detectCleanStall(sessions)).toBeNull();
  });

  it('requires the most recent session to be clean', () => {
    // A stall has to be current. A lift that failed last time is asking a
    // different question, and the plateau path is the one that answers it.
    const sessions = runOf(6);
    sessions[0] = session('2026-08-28', 125, [set({ failed_reps: 4 })]);
    expect(detectCleanStall(sessions)).toBeNull();
  });

  it('treats a session with no sets as not clean', () => {
    const sessions = runOf(4);
    sessions[0] = session('2026-08-28', 125, []);
    expect(detectCleanStall(sessions)).toBeNull();
  });
});

describe('grading the evidence', () => {
  it('calls it measured when reps were carried past target', () => {
    const sessions = runOf(4);
    sessions[0] = session('2026-08-28', 125, [set(), set(), set({ extra_reps: 3 })]);
    const stall = detectCleanStall(sessions);
    expect(stall?.evidence).toBe('measured');
    expect(stall?.extraReps).toBe(3);
  });

  it('calls it measured when the last set declared reps in reserve', () => {
    const sessions = runOf(4);
    sessions[0] = session('2026-08-28', 125, [set(), set(), set({ set_rir: '3plus' })]);
    expect(detectCleanStall(sessions)?.evidence).toBe('measured');
  });

  it('calls it inferred when nothing recorded headroom either way', () => {
    // Every session logged before the columns existed lands here, which is why
    // the two grades are kept apart: silence is not evidence.
    const stall = detectCleanStall(runOf(14));
    expect(stall?.evidence).toBe('inferred');
    expect(stall?.extraReps).toBe(0);
  });

  it('does not treat one or two reps in reserve as headroom', () => {
    const sessions = runOf(4);
    sessions[0] = session('2026-08-28', 125, [set({ set_rir: '1-2' })]);
    expect(detectCleanStall(sessions)?.evidence).toBe('inferred');
  });

  it('sums overage across the whole run, not just the last session', () => {
    const sessions = runOf(4);
    sessions[0] = session('2026-08-28', 125, [set({ extra_reps: 2 })]);
    sessions[1] = session('2026-08-27', 125, [set({ extra_reps: 1 })]);
    expect(detectCleanStall(sessions)?.extraReps).toBe(3);
  });
});

describe('how it reads', () => {
  const lb = (kg: number) => `${Math.round(kg * 2.20462)} lb`;

  it('states the case when it has been measured', () => {
    const sessions = runOf(4, 124.738);
    sessions[0] = session('2026-08-28', 124.738, [set({ extra_reps: 3 })]);
    const stall = detectCleanStall(sessions)!;
    expect(describeCleanStall(stall, lb)).toBe('275 lb for 4 sessions, 3 reps past target. Ready to go up.');
  });

  it('asks rather than asserts when it is only inferred', () => {
    // All it really knows is that nothing was recorded as difficult — which is
    // also what a well-judged load looks like.
    const stall = detectCleanStall(runOf(14, 124.738))!;
    expect(describeCleanStall(stall, lb)).toBe('275 lb for 14 sessions, every set completed. Time to try more?');
  });
});

describe('the squat that started this', () => {
  it('reports the real case: fourteen clean sessions at an unchanged load', () => {
    const stall = detectCleanStall(runOf(14, 124.738));
    expect(stall).not.toBeNull();
    expect(stall?.sessions).toBe(14);
    // No overage exists in seventeen months of history, because the column did
    // not exist. Inferred is the honest grade for all of it.
    expect(stall?.evidence).toBe('inferred');
  });
});

describe('unloaded exercises', () => {
  it('says nothing about a bodyweight movement', () => {
    // "0 lb for 4 sessions, time to try more?" appeared on hanging leg raises
    // in the running app. There is no weight to add, and the query used to
    // sanity-check the detector had filtered weight > 0 — so the one case that
    // breaks it was excluded from the evidence before it could be seen.
    expect(detectCleanStall(runOf(6, 0))).toBeNull();
  });

  it('still reports a lightly loaded exercise', () => {
    // 5 lb crunches are loaded, however lightly, so the advice is meaningful.
    expect(detectCleanStall(runOf(6, 2.27))?.sessions).toBe(6);
  });
});
