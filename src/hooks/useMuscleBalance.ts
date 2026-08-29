import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  summariseEffectiveSets,
  type CountableSet,
  type EffectiveSetSummary,
} from '../lib/effectiveSets';

interface Row {
  weight: number | null;
  reps: number | null;
  failed_reps: number | null;
  extra_reps: number | null;
  workout_exercise: {
    exercise: {
      name: string;
      muscle_groups: Array<{
        is_primary: boolean | null;
        muscle_group: { name: string } | null;
      }> | null;
    } | null;
    workout: { user_id: string; start_time: string | null; end_time: string | null } | null;
  } | null;
}

const DAYS: Record<string, number> = { '30': 30, '90': 90, '180': 180, all: 730 };

/**
 * Per-muscle effective sets over a window.
 *
 * The window is divided by its real elapsed weeks rather than assumed to be
 * one, because attendance is 2.0–2.4 sessions a week against a target of four —
 * a rate computed as though every week were full would overstate everything by
 * roughly half.
 */
export function useMuscleBalance(timeRange: '30' | '90' | '180' | 'all') {
  const { user } = useAuth();
  const [summary, setSummary] = useState<EffectiveSetSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      const days = DAYS[timeRange] ?? 180;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('exercise_logs')
        .select(
          `weight, reps, failed_reps, extra_reps,
           workout_exercise:workout_exercise_id(
             exercise:exercise_id(
               name,
               muscle_groups:exercise_muscle_groups(
                 is_primary,
                 muscle_group:muscle_group_id(name)
               )
             ),
             workout:workout_id(user_id, start_time, end_time)
           )`,
        )
        .gte('created_at', since);

      if (cancelled) return;
      if (error || !data) {
        console.error('Could not load muscle balance:', error);
        setLoading(false);
        return;
      }

      const sets: CountableSet[] = [];
      let earliest: string | null = null;
      let latest: string | null = null;

      for (const row of data as unknown as Row[]) {
        const exercise = row.workout_exercise?.exercise;
        const workout = row.workout_exercise?.workout;

        // Ownership and the finished-workout test are applied here rather than
        // in the query: both live on an embedded resource, where a filter that
        // fails does not error — it silently stops filtering.
        if (!exercise || !workout || workout.user_id !== user.id || !workout.end_time) continue;

        const day = (workout.start_time ?? '').slice(0, 10);
        if (day) {
          if (!earliest || day < earliest) earliest = day;
          if (!latest || day > latest) latest = day;
        }

        sets.push({
          reps: row.reps,
          failed_reps: row.failed_reps,
          extra_reps: row.extra_reps,
          weight: row.weight,
          exerciseName: exercise.name,
          muscles: (exercise.muscle_groups ?? [])
            .filter((m) => !!m.muscle_group?.name)
            .map((m) => ({ name: m.muscle_group!.name, isPrimary: m.is_primary === true })),
        });
      }

      // Elapsed weeks from the data itself, not from the requested window: a
      // 180-day range containing three months of training is three months of
      // training.
      const spanDays =
        earliest && latest
          ? Math.max(
              1,
              (new Date(latest).getTime() - new Date(earliest).getTime()) / (24 * 60 * 60 * 1000) + 1,
            )
          : 7;

      if (!cancelled) {
        setSummary(summariseEffectiveSets(sets, spanDays / 7));
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user, timeRange]);

  return { summary, loading };
}
