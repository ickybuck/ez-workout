import { describe, it, expect } from 'vitest';
import { planLogWrite } from './planLogWrite';
import { toKg } from '../src/lib/weight';

const set = (set_number: number, weight: number | null, reps: number | null = 10) => ({
  set_number,
  weight,
  reps,
});

describe('which set', () => {
  it('starts at one when nothing is logged', () => {
    expect(planLogWrite({ existing: [], performed: 10 }).setNumber).toBe(1);
  });

  it('takes the next one after the highest logged', () => {
    expect(planLogWrite({ existing: [set(1, 80), set(2, 80)], performed: 10 }).setNumber).toBe(3);
  });

  it('counts from the highest, not from how many there are', () => {
    // Logging set 5 of an exercise that has two sets must not then offer 3.
    expect(planLogWrite({ existing: [set(1, 80), set(5, 80)], performed: 10 }).setNumber).toBe(6);
  });

  it('uses the set asked for', () => {
    const write = planLogWrite({ existing: [set(1, 80), set(2, 80)], performed: 9, requestedSet: 2 });
    expect(write.setNumber).toBe(2);
    expect(write.replacing).toBe(true);
  });

  it('says when it is not replacing anything', () => {
    expect(planLogWrite({ existing: [set(1, 80)], performed: 9 }).replacing).toBe(false);
  });

  it('refuses a set number below one', () => {
    expect(() => planLogWrite({ existing: [], performed: 10, requestedSet: 0 })).toThrow(/1 or more/);
  });
});

describe('which weight', () => {
  it('uses the weight given', () => {
    const write = planLogWrite({ existing: [set(1, 80)], performed: 10, requestedWeightKg: 90 });
    expect(write).toMatchObject({ weightKg: 90, weightSource: 'given' });
  });

  it('carries the previous set forward when none is given', () => {
    const write = planLogWrite({ existing: [set(1, 80)], performed: 10 });
    expect(write).toMatchObject({ weightKg: 80, weightSource: 'carried' });
  });

  it('carries the nearest earlier set, not the first', () => {
    // A mid-exercise drop should stick for the sets after it rather than
    // springing back to what set one used.
    const write = planLogWrite({ existing: [set(1, 80), set(2, 70)], performed: 8 });
    expect(write.weightKg).toBe(70);
  });

  it('ignores later sets when deciding what to carry', () => {
    const write = planLogWrite({
      existing: [set(1, 80), set(2, 70), set(3, 60)],
      performed: 8,
      requestedSet: 2,
    });
    expect(write.weightKg).toBe(80);
  });

  it('falls back to the exercise default before giving up', () => {
    const write = planLogWrite({ existing: [], performed: 10, defaultWeightKg: 61.235 });
    expect(write).toMatchObject({ weightKg: 61.235, weightSource: 'default' });
  });

  it('keeps the weight already on the set when correcting only reps', () => {
    const write = planLogWrite({ existing: [set(1, 80)], performed: 8, requestedSet: 1 });
    expect(write).toMatchObject({ weightKg: 80, weightSource: 'existing' });
  });

  it('reports no weight rather than inventing zero', () => {
    // Zero is a real answer -- every bodyweight movement -- so a missing
    // lookup must not produce it. The column stays null.
    const write = planLogWrite({ existing: [], performed: 10 });
    expect(write).toMatchObject({ weightKg: null, weightSource: 'none' });
  });

  it('takes a genuine zero as a weight when it is given', () => {
    const write = planLogWrite({ existing: [], performed: 14, requestedWeightKg: 0 });
    expect(write).toMatchObject({ weightKg: 0, weightSource: 'given' });
  });

  it('stores whatever kilogram value it was handed, unrounded by this step', () => {
    // Conversion belongs to the caller; 165 lb is 74.843 kg and must survive
    // intact, because a round-trip through a rounded kilogram reads back as
    // 164.99 lb.
    const kg = Number(toKg(165, 'lb').toFixed(3));
    expect(planLogWrite({ existing: [], performed: 8, requestedWeightKg: kg }).weightKg).toBe(kg);
  });
});

describe('which target', () => {
  it('prefers the target already on the set over the exercise default', () => {
    // The row is what this workout prescribed; the default may have moved on
    // since, and rewriting the target would turn a completed set into a
    // failed one after the fact.
    const write = planLogWrite({
      existing: [set(1, 80, 12)],
      performed: 12,
      requestedSet: 1,
      defaultReps: 10,
    });
    expect(write.plan).toMatchObject({ reps: 12, failed_reps: 0, extra_reps: 0 });
  });

  it('uses the exercise default for a new set', () => {
    const write = planLogWrite({ existing: [], performed: 8, defaultReps: 10 });
    expect(write.plan).toMatchObject({ reps: 10, failed_reps: 2, extra_reps: 0 });
  });

  it('makes what was done the target when nothing prescribes one', () => {
    const write = planLogWrite({ existing: [], performed: 8 });
    expect(write.plan).toMatchObject({ reps: 8, failed_reps: 0, extra_reps: 0 });
  });

  it('records an overage against the target', () => {
    const write = planLogWrite({ existing: [], performed: 13, defaultReps: 10 });
    expect(write.plan).toMatchObject({ reps: 10, failed_reps: 0, extra_reps: 3 });
  });

  it('records a set of zero reps as not completed', () => {
    const write = planLogWrite({ existing: [], performed: 0, defaultReps: 10 });
    expect(write.plan).toMatchObject({ reps: 10, failed_reps: 10, completed: false });
  });
});

describe('logging the same set twice', () => {
  it('produces the same write both times', () => {
    // The retry case. The upsert key makes the database side safe; this makes
    // the decision side safe, so a repeated call does not quietly land on the
    // next set number instead.
    const existing = [set(1, 80), set(2, 80)];
    const first = planLogWrite({ existing, performed: 9, requestedSet: 2, requestedWeightKg: 75 });
    const second = planLogWrite({ existing, performed: 9, requestedSet: 2, requestedWeightKg: 75 });
    expect(first).toEqual(second);
  });
});
