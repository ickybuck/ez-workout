import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { detectCleanStall, type CleanStall, type ExerciseSession } from '../lib/cleanStall';

/** Enough history to see a stall, without dragging seventeen months into memory. */
const LOOKBACK_DAYS = 200;

interface LogRow {
  weight: number | null;
  reps: number | null;
  failed_reps: number | null;
  extra_reps: number | null;
  set_rir: string | null;
  workout_exercise: {
    exercise_id: string | null;
    workout: { user_id: string; start_time: string | null; end_time: string | null } | null;
  } | null;
}

/**
 * Clean stalls for a set of exercises, keyed by exercise id.
 *
 * Deliberately scoped to the exercises in the current workout rather than the
 * whole library. Run across everything, this fires on fourteen lifts at once
 * for the athlete it was built for — several with runs past twenty sessions —
 * and fourteen simultaneous suggestions is noise, not guidance. One prompt on
 * the exercise in front of you is a decision you can act on.
 */
export function useCleanStalls(exerciseIds: string[], userId: string | undefined) {
  const [stalls, setStalls] = useState<Record<string, CleanStall>>({});

  // Sorted and joined so the effect does not re-run on a new array of the same
  // ids, which is what a fresh render produces every time.
  const key = [...exerciseIds].sort().join(',');

  useEffect(() => {
    if (!userId || exerciseIds.length === 0) return;
    let cancelled = false;

    const load = async () => {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('exercise_logs')
        .select(
          `weight, reps, failed_reps, extra_reps, set_rir,
           workout_exercise:workout_exercise_id(
             exercise_id,
             workout:workout_id(user_id, start_time, end_time)
           )`,
        )
        .gte('created_at', since);

      if (cancelled || error || !data) {
        if (error) console.error('Could not load history for stall detection:', error);
        return;
      }

      // Group into one entry per exercise per session. Filtering in JS rather
      // than in the query because the ownership and finished-workout tests live
      // on an embedded resource, where a filter that fails does not error — it
      // silently stops filtering.
      const byExercise = new Map<string, Map<string, ExerciseSession>>();

      for (const row of data as unknown as LogRow[]) {
        const exerciseId = row.workout_exercise?.exercise_id;
        const workout = row.workout_exercise?.workout;

        if (!exerciseId || !exerciseIds.includes(exerciseId)) continue;
        if (!workout || workout.user_id !== userId || !workout.end_time) continue;

        const date = (workout.start_time ?? '').slice(0, 10);
        if (!date) continue;

        const sessions = byExercise.get(exerciseId) ?? new Map<string, ExerciseSession>();
        const session = sessions.get(date) ?? { date, topSetWeight: 0, sets: [] };

        session.topSetWeight = Math.max(session.topSetWeight, row.weight ?? 0);
        session.sets.push({
          reps: row.reps,
          failed_reps: row.failed_reps,
          extra_reps: row.extra_reps,
          set_rir: row.set_rir,
        });

        sessions.set(date, session);
        byExercise.set(exerciseId, sessions);
      }

      const found: Record<string, CleanStall> = {};
      for (const [exerciseId, sessions] of byExercise) {
        const ordered = [...sessions.values()].sort((a, b) => b.date.localeCompare(a.date));
        const stall = detectCleanStall(ordered);
        if (stall) found[exerciseId] = stall;
      }

      if (!cancelled) setStalls(found);
    };

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, userId]);

  return stalls;
}
