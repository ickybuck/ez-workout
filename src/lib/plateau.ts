import { calculateLogVolume } from './volumeUtils';
import type { HistoryWorkout } from '../hooks/useWorkoutHistory';

/**
 * Plateau detection over workout history.
 *
 * Extracted from PlateauDetector so the rule can be tested. It is the most
 * opinionated analysis in the app — it decides when to tell someone to add
 * weight — and it was previously buried inside a fetch callback where nothing
 * could exercise it.
 */

export interface ExerciseSession {
  date: string;
  maxWeight: number;
  maxReps: number;
  volume: number;
}

export interface PlateauCandidate {
  id: string;
  name: string;
  lastWeight: number;
  lastReps: number;
  sessions: number;
  plateauWorkouts: number;
}

/** Sessions needed before a plateau can be called at all. */
export const MIN_SESSIONS = 3;

/** Volume swing under this percentage counts as "not moving". */
export const VOLUME_STAGNANT_PERCENT = 5;

/**
 * Roll history up into one entry per exercise per session, keeping only
 * completed sets. Sessions come out oldest first, matching the query order.
 */
export function toExerciseSessions(
  workouts: HistoryWorkout[],
): Record<string, { name: string; sessions: ExerciseSession[] }> {
  const byExercise: Record<string, { name: string; sessions: ExerciseSession[] }> = {};

  workouts.forEach((workout) => {
    workout.workout_exercises?.forEach((we) => {
      if (!we.exercise || !workout.start_time) return;

      const completed = we.exercise_logs?.filter((log) => log.completed) ?? [];
      if (completed.length === 0) return;

      const entry = (byExercise[we.exercise.id] ??= { name: we.exercise.name, sessions: [] });

      entry.sessions.push({
        date: workout.start_time,
        maxWeight: Math.max(...completed.map((l) => l.weight)),
        maxReps: Math.max(...completed.map((l) => l.reps)),
        volume: completed.reduce((sum, l) => sum + calculateLogVolume(l), 0),
      });
    });
  });

  return byExercise;
}

/**
 * How many sessions, counting back from the most recent, repeat the same
 * top set. This is what gets reported as "stuck for N workouts".
 */
export function consecutivePlateauSessions(sessions: ExerciseSession[]): number {
  const last = sessions[sessions.length - 1];
  let count = 1;

  for (let i = sessions.length - 2; i >= 0; i--) {
    if (sessions[i].maxWeight !== last.maxWeight || sessions[i].maxReps !== last.maxReps) break;
    count++;
  }

  return count;
}

/**
 * Split candidates into weighted and bodyweight.
 *
 * Bodyweight work is separated by a top set at zero weight, because the
 * useful advice differs: add load to one, add reps to the other.
 */
export function detectPlateaus(workouts: HistoryWorkout[]): {
  weighted: PlateauCandidate[];
  bodyweight: PlateauCandidate[];
} {
  const weighted: PlateauCandidate[] = [];
  const bodyweight: PlateauCandidate[] = [];

  Object.entries(toExerciseSessions(workouts)).forEach(([id, data]) => {
    if (data.sessions.length < MIN_SESSIONS) return;

    const recent = data.sessions.slice(-MIN_SESSIONS);
    const weights = recent.map((s) => s.maxWeight);
    const reps = recent.map((s) => s.maxReps);
    const volumes = recent.map((s) => s.volume);

    const weightStagnant = weights.every((w) => w === weights[0]);
    const repsStagnant = reps.every((r) => r === reps[0]);

    // Guard the division: a run of zero-volume sessions would otherwise
    // produce NaN, and NaN < 5 is false, so those would never be flagged.
    const volumeChange =
      volumes[0] > 0 ? ((volumes[volumes.length - 1] - volumes[0]) / volumes[0]) * 100 : 0;

    const stalled =
      (weightStagnant && repsStagnant) || Math.abs(volumeChange) < VOLUME_STAGNANT_PERCENT;
    if (!stalled) return;

    const last = data.sessions[data.sessions.length - 1];
    const candidate: PlateauCandidate = {
      id,
      name: data.name,
      lastWeight: last.maxWeight,
      lastReps: last.maxReps,
      sessions: data.sessions.length,
      plateauWorkouts: consecutivePlateauSessions(data.sessions),
    };

    if (last.maxWeight === 0) bodyweight.push(candidate);
    else weighted.push(candidate);
  });

  return { weighted, bodyweight };
}
