import { describe, it, expect } from 'vitest';
import { planSet, performedFrom } from './planSet';
import { performedReps, classifySet } from '../src/lib/stopReason';

describe('planSet', () => {
  it('records a set that hit the target with no shortfall and no overage', () => {
    expect(planSet({ performed: 10, prescribed: 10 })).toEqual({
      reps: 10,
      failed_reps: 0,
      extra_reps: 0,
      completed: true,
    });
  });

  it('puts a shortfall in failed_reps and leaves reps as the prescription', () => {
    // The trap this module exists for: 8 performed against a target of 10 is
    // reps=10, failed=2 -- not reps=8. Writing 8 would erase the failure and
    // make a stalled lift read as a completed one.
    expect(planSet({ performed: 8, prescribed: 10 })).toEqual({
      reps: 10,
      failed_reps: 2,
      extra_reps: 0,
      completed: true,
    });
  });

  it('puts an overage in extra_reps, which is the measured half of double progression', () => {
    expect(planSet({ performed: 12, prescribed: 10 })).toEqual({
      reps: 10,
      failed_reps: 0,
      extra_reps: 2,
      completed: true,
    });
  });

  it('never records a shortfall and an overage together', () => {
    // exercise_logs_shortfall_or_overage_check rejects rows where both are
    // non-zero, so a plan that produced both would fail at the database.
    for (const performed of [0, 3, 10, 11, 25]) {
      const plan = planSet({ performed, prescribed: 10 });
      expect(plan.failed_reps === 0 || plan.extra_reps === 0).toBe(true);
    }
  });

  it('treats a set of zero reps as not completed', () => {
    // A skipped set is the absence of a set, not a failure with a big number.
    const plan = planSet({ performed: 0, prescribed: 10 });
    expect(plan).toEqual({ reps: 10, failed_reps: 10, extra_reps: 0, completed: false });
    expect(classifySet(plan)).toBe('skipped');
  });

  it('makes what was done the prescription when nothing prescribes it', () => {
    // An exercise added mid-session has no target. Inventing one would
    // manufacture a shortfall out of nothing.
    expect(planSet({ performed: 9 })).toEqual({
      reps: 9,
      failed_reps: 0,
      extra_reps: 0,
      completed: true,
    });
    expect(planSet({ performed: 9, prescribed: null })).toEqual({
      reps: 9,
      failed_reps: 0,
      extra_reps: 0,
      completed: true,
    });
    expect(planSet({ performed: 9, prescribed: 0 })).toEqual({
      reps: 9,
      failed_reps: 0,
      extra_reps: 0,
      completed: true,
    });
  });

  it('refuses rep counts that are not whole numbers of zero or more', () => {
    expect(() => planSet({ performed: -1 })).toThrow(/0 or more/);
    expect(() => planSet({ performed: 8.5 })).toThrow(/whole number/);
    expect(() => planSet({ performed: 8, prescribed: -2 })).toThrow(/Prescribed/);
  });
});

describe('agreement with the app', () => {
  it('round-trips through the app reading of a row', () => {
    // The real check: whatever this writes, src/lib/stopReason reads back as
    // the number the person actually reported. These two must not drift.
    for (const [performed, prescribed] of [
      [10, 10],
      [8, 10],
      [12, 10],
      [0, 10],
      [7, null],
    ] as Array<[number, number | null]>) {
      const plan = planSet({ performed, prescribed });
      expect(performedReps(plan)).toBe(performed);
      expect(performedFrom(plan)).toBe(performed);
    }
  });

  it('classifies the way the app would', () => {
    expect(classifySet(planSet({ performed: 10, prescribed: 10 }))).toBe('complete');
    expect(classifySet(planSet({ performed: 8, prescribed: 10 }))).toBe('partial');
    expect(classifySet(planSet({ performed: 12, prescribed: 10 }))).toBe('exceeded');
  });
});

describe('performedFrom', () => {
  it('reads a historical row with nulls where nothing was recorded', () => {
    expect(performedFrom({ reps: 10, failed_reps: null, extra_reps: null })).toBe(10);
    expect(performedFrom({ reps: 10, failed_reps: 3 })).toBe(7);
    expect(performedFrom({ reps: null })).toBe(0);
  });
});
