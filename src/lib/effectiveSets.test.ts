import { describe, it, expect } from 'vitest';
import {
  setContribution,
  summariseEffectiveSets,
  shouldSplitAcrossSessions,
  PRIMARY_WEIGHT,
  SECONDARY_WEIGHT,
  type CountableSet,
} from './effectiveSets';

const squat = (over: Partial<CountableSet> = {}): CountableSet => ({
  reps: 10,
  failed_reps: 0,
  weight: 125,
  exerciseName: 'Squats',
  muscles: [
    { name: 'Quadriceps', isPrimary: true },
    { name: 'Glutes', isPrimary: true },
    { name: 'Hamstrings', isPrimary: false },
  ],
  ...over,
});

const plank = (over: Partial<CountableSet> = {}): CountableSet => ({
  reps: 45,
  failed_reps: 0,
  weight: 0,
  exerciseName: 'Planks',
  muscles: [{ name: 'Abdominals', isPrimary: true }],
  ...over,
});

describe('what a set contributes', () => {
  it('counts a completed loaded set', () => {
    expect(setContribution(squat())).toBe('counts');
  });

  it('treats unloaded work as conditioning, not as hypertrophy volume', () => {
    // Light ballistic movement delivers little mechanical tension to any single
    // muscle, and tension is the driver. Counted separately, never discarded.
    expect(setContribution(plank())).toBe('conditioning');
  });

  it('excludes a skipped set', () => {
    expect(setContribution(squat({ failed_reps: 10 }))).toBe('incomplete');
  });

  it('excludes a set where less than half the reps were performed', () => {
    expect(setContribution(squat({ failed_reps: 6 }))).toBe('incomplete');
  });

  it('counts a set that fell a little short', () => {
    // Eight of ten is a hard set that ran out of road, not a non-event.
    expect(setContribution(squat({ failed_reps: 2 }))).toBe('counts');
  });

  it('counts a set carried past its target', () => {
    expect(setContribution(squat({ extra_reps: 3 }))).toBe('counts');
  });

  it('classifies before it checks load, so a skipped bodyweight set is incomplete', () => {
    expect(setContribution(plank({ failed_reps: 45 }))).toBe('incomplete');
  });
});

describe('weighting primary against secondary movers', () => {
  it('gives a full set to each primary muscle and half to each secondary', () => {
    const summary = summariseEffectiveSets([squat()]);
    const byMuscle = Object.fromEntries(summary.perMuscle.map((m) => [m.muscle, m.effectiveSets]));

    expect(byMuscle.Quadriceps).toBe(PRIMARY_WEIGHT);
    expect(byMuscle.Glutes).toBe(PRIMARY_WEIGHT);
    expect(byMuscle.Hamstrings).toBe(SECONDARY_WEIGHT);
  });

  it('accumulates across sets', () => {
    const summary = summariseEffectiveSets([squat(), squat(), squat()]);
    expect(summary.perMuscle.find((m) => m.muscle === 'Quadriceps')?.effectiveSets).toBe(3);
    expect(summary.perMuscle.find((m) => m.muscle === 'Hamstrings')?.effectiveSets).toBe(1.5);
  });

  it('ranks by volume, heaviest first', () => {
    const summary = summariseEffectiveSets([squat()]);
    expect(summary.perMuscle[0].effectiveSets).toBeGreaterThanOrEqual(
      summary.perMuscle[summary.perMuscle.length - 1].effectiveSets,
    );
  });
});

describe('nothing disappears silently', () => {
  it('reports exercises with no muscle mapping instead of dropping them', () => {
    // Seated Cable Rows and Leg Press had no mapping at all — 216 sets
    // contributing to nothing, unnoticed for seventeen months because nothing
    // read the mapping closely enough to miss them.
    const orphan = squat({ exerciseName: 'Seated Cable Rows', muscles: [] });
    const summary = summariseEffectiveSets([orphan, orphan, squat()]);

    expect(summary.unmapped).toEqual([{ exerciseName: 'Seated Cable Rows', sets: 2 }]);
    expect(summary.perMuscle.find((m) => m.muscle === 'Quadriceps')?.effectiveSets).toBe(1);
  });

  it('counts conditioning and incomplete sets separately', () => {
    const summary = summariseEffectiveSets([
      squat(),
      plank(),
      plank(),
      squat({ failed_reps: 10 }),
    ]);

    expect(summary.conditioningSets).toBe(2);
    expect(summary.incompleteSets).toBe(1);
  });

  it('keeps unloaded work out of the per-muscle tally entirely', () => {
    // The whole point: abdominals were reading 33.4 a week largely on the
    // strength of unloaded high-rep work that delivers little tension.
    const summary = summariseEffectiveSets([plank(), plank(), plank()]);
    expect(summary.perMuscle).toHaveLength(0);
    expect(summary.conditioningSets).toBe(3);
  });
});

describe('scaling to a weekly rate', () => {
  it('divides by the elapsed weeks rather than assuming one', () => {
    // Attendance is 2.0-2.4 sessions a week against a target of 4, so treating
    // every week as full would overstate everything by roughly half.
    const sets = Array.from({ length: 20 }, () => squat());
    const summary = summariseEffectiveSets(sets, 4);
    expect(summary.perMuscle.find((m) => m.muscle === 'Quadriceps')?.effectiveSets).toBe(5);
  });

  it('does not divide by zero', () => {
    const summary = summariseEffectiveSets([squat()], 0);
    expect(summary.perMuscle[0].effectiveSets).toBe(1);
  });

  it('rounds to one decimal, not to false precision', () => {
    const sets = Array.from({ length: 10 }, () => squat());
    const summary = summariseEffectiveSets(sets, 3);
    expect(summary.perMuscle.find((m) => m.muscle === 'Hamstrings')?.effectiveSets).toBe(1.7);
  });
});

describe('verdicts against the weekly band', () => {
  const tallyFor = (count: number) =>
    summariseEffectiveSets(
      Array.from({ length: count }, () =>
        squat({ muscles: [{ name: 'Quadriceps', isPrimary: true }] }),
      ),
    ).perMuscle[0];

  it.each([
    [4, 'under-served'],
    [12, 'in range'],
    [35, 'high'],
  ] as const)('calls %i sets %s', (count, expected) => {
    expect(tallyFor(count).verdict).toBe(expected);
  });

  it('flags a muscle worth splitting across sessions', () => {
    expect(shouldSplitAcrossSessions(tallyFor(14))).toBe(true);
    expect(shouldSplitAcrossSessions(tallyFor(6))).toBe(false);
  });
});
