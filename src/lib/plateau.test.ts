import { describe, it, expect } from 'vitest';
import {
  detectPlateaus,
  toExerciseSessions,
  consecutivePlateauSessions,
  MIN_SESSIONS,
} from './plateau';
import type { HistoryWorkout } from '../hooks/useWorkoutHistory';

/** Build a workout containing one exercise with the given completed sets. */
const workout = (
  date: string,
  exercise: { id: string; name: string },
  sets: Array<{ weight: number; reps: number; completed?: boolean }>,
): HistoryWorkout => ({
  id: `w-${date}`,
  start_time: date,
  end_time: date,
  template_id: null,
  workout_templates: null,
  workout_exercises: [
    {
      id: `we-${date}-${exercise.id}`,
      exercise,
      exercise_logs: sets.map((s) => ({
        weight: s.weight,
        reps: s.reps,
        failed_reps: 0,
        completed: s.completed ?? true,
        created_at: date,
      })),
    },
  ],
});

const bench = { id: 'bench', name: 'Bench Press' };
const pullups = { id: 'pullups', name: 'Pull Ups' };

/** N identical sessions of the same top set — the textbook plateau. */
const identicalSessions = (n: number, ex = bench, weight = 100, reps = 5) =>
  Array.from({ length: n }, (_, i) =>
    workout(`2026-01-${String(i + 1).padStart(2, '0')}`, ex, [{ weight, reps }]),
  );

describe('toExerciseSessions', () => {
  it('keeps only completed sets', () => {
    const sessions = toExerciseSessions([
      workout('2026-01-01', bench, [
        { weight: 100, reps: 5 },
        { weight: 200, reps: 1, completed: false },
      ]),
    ]);
    // The uncompleted 200 must not become the session max.
    expect(sessions.bench.sessions[0].maxWeight).toBe(100);
  });

  it('ignores an exercise with no completed sets at all', () => {
    const sessions = toExerciseSessions([
      workout('2026-01-01', bench, [{ weight: 100, reps: 5, completed: false }]),
    ]);
    expect(sessions.bench).toBeUndefined();
  });

  it('records one session per workout, oldest first', () => {
    const sessions = toExerciseSessions([
      workout('2026-01-01', bench, [{ weight: 100, reps: 5 }]),
      workout('2026-01-02', bench, [{ weight: 105, reps: 5 }]),
    ]);
    expect(sessions.bench.sessions.map((s) => s.maxWeight)).toEqual([100, 105]);
  });
});

describe('consecutivePlateauSessions', () => {
  it('counts back only while the top set repeats', () => {
    const sessions = [
      { date: 'a', maxWeight: 90, maxReps: 5, volume: 450 },
      { date: 'b', maxWeight: 100, maxReps: 5, volume: 500 },
      { date: 'c', maxWeight: 100, maxReps: 5, volume: 500 },
      { date: 'd', maxWeight: 100, maxReps: 5, volume: 500 },
    ];
    expect(consecutivePlateauSessions(sessions)).toBe(3);
  });

  it('is 1 when the most recent session differs from the one before', () => {
    const sessions = [
      { date: 'a', maxWeight: 100, maxReps: 5, volume: 500 },
      { date: 'b', maxWeight: 105, maxReps: 5, volume: 525 },
    ];
    expect(consecutivePlateauSessions(sessions)).toBe(1);
  });
});

describe('detectPlateaus', () => {
  it('flags an exercise stuck at the same top set', () => {
    const { weighted } = detectPlateaus(identicalSessions(4));
    expect(weighted).toHaveLength(1);
    expect(weighted[0]).toMatchObject({
      id: 'bench',
      lastWeight: 100,
      lastReps: 5,
      sessions: 4,
      plateauWorkouts: 4,
    });
  });

  it(`needs at least ${MIN_SESSIONS} sessions before calling anything`, () => {
    expect(detectPlateaus(identicalSessions(MIN_SESSIONS - 1)).weighted).toHaveLength(0);
  });

  it('does not flag steady progression', () => {
    const progressing = [100, 105, 110, 115].map((w, i) =>
      workout(`2026-01-0${i + 1}`, bench, [{ weight: w, reps: 5 }]),
    );
    expect(detectPlateaus(progressing).weighted).toHaveLength(0);
  });

  it('separates bodyweight work, which is identified by a zero-weight top set', () => {
    // The advice differs: add load to one, add reps to the other.
    const { weighted, bodyweight } = detectPlateaus(
      identicalSessions(4, pullups, 0, 10),
    );
    expect(weighted).toHaveLength(0);
    expect(bodyweight).toHaveLength(1);
    expect(bodyweight[0]).toMatchObject({ id: 'pullups', lastReps: 10 });
  });

  it('does not produce NaN when a run of sessions has zero volume', () => {
    // volumes[0] === 0 makes the percentage change a division by zero, and
    // NaN < 5 is false — so these would silently never be flagged.
    const zeroVolume = Array.from({ length: 4 }, (_, i) =>
      workout(`2026-01-0${i + 1}`, pullups, [{ weight: 0, reps: 0 }]),
    );
    const { bodyweight } = detectPlateaus(zeroVolume);
    expect(bodyweight).toHaveLength(1);
    expect(bodyweight[0].plateauWorkouts).toBe(4);
  });

  it('reports total sessions separately from consecutive plateau sessions', () => {
    const history = [
      workout('2026-01-01', bench, [{ weight: 90, reps: 5 }]),
      ...identicalSessions(3).map((w, i) => ({ ...w, start_time: `2026-02-0${i + 1}` })),
    ];
    const { weighted } = detectPlateaus(history);
    expect(weighted[0].sessions).toBe(4);
    expect(weighted[0].plateauWorkouts).toBe(3);
  });
});
