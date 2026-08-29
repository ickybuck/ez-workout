import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { createQueryCache } from '../lib/queryCache';

/**
 * The single source of workout history for the Insights section.
 *
 * All five tabs were running the same query — every finished workout in the
 * range with its nested exercises and set logs — each with its own loading
 * state and no sharing. Switching tabs refetched the lot, five times over for
 * one answer.
 *
 * The selection below is the union of what those five needed, so each can
 * keep its own analysis while sharing one fetch and one cache.
 */

export type TimeRange = '30' | '90' | '180' | 'all';

/**
 * Normalised at the boundary: the columns are nullable in the schema but the
 * analyses all want numbers. Coercing once here beats every consumer
 * defending against null, and beats casting the nulls away and pretending.
 */
export interface HistoryLog {
  weight: number;
  reps: number;
  failed_reps: number;
  completed: boolean;
  created_at: string | null;
}

export interface HistoryExercise {
  id: string;
  exercise: { id: string; name: string } | null;
  exercise_logs: HistoryLog[] | null;
}

export interface HistoryWorkout {
  id: string;
  start_time: string | null;
  end_time: string | null;
  template_id: string | null;
  workout_templates: { id: string; name: string } | null;
  workout_exercises: HistoryExercise[] | null;
}

const SELECT = `
  id,
  start_time,
  end_time,
  template_id,
  workout_templates ( id, name ),
  workout_exercises (
    id,
    exercise:exercises ( id, name ),
    exercise_logs ( weight, reps, failed_reps, completed, created_at )
  )
` as const;

/** Module-level so every tab shares it for the life of the page. */
const cache = createQueryCache<HistoryWorkout[]>();

export function rangeStart(range: TimeRange, now: Date): Date {
  if (range === 'all') return new Date(0);
  const start = new Date(now);
  start.setDate(now.getDate() - Number(range));
  return start;
}

/** Shape as it arrives from PostgREST, before null coercion. */
interface RawLog {
  weight: number | null;
  reps: number | null;
  failed_reps: number | null;
  completed: boolean | null;
  created_at: string | null;
}

interface RawWorkout {
  id: string;
  start_time: string | null;
  end_time: string | null;
  template_id: string | null;
  workout_templates: { id: string; name: string } | null;
  workout_exercises:
    | Array<{
        id: string;
        exercise: { id: string; name: string } | null;
        exercise_logs: RawLog[] | null;
      }>
    | null;
}

/** Exported for testing: null coercion is easy to get subtly wrong. */
export function normalizeWorkouts(rows: RawWorkout[]): HistoryWorkout[] {
  return rows.map((w) => ({
    ...w,
    workout_exercises: (w.workout_exercises ?? []).map((we) => ({
      ...we,
      exercise_logs: (we.exercise_logs ?? []).map((l) => ({
        weight: l.weight ?? 0,
        reps: l.reps ?? 0,
        failed_reps: l.failed_reps ?? 0,
        // A null `completed` means the set was never marked done, so false is
        // the honest reading — and it keeps unlogged sets out of volume.
        completed: l.completed ?? false,
        created_at: l.created_at,
      })),
    })),
  }));
}

async function fetchHistory(userId: string, range: TimeRange): Promise<HistoryWorkout[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select(SELECT)
    .eq('user_id', userId)
    .gte('start_time', rangeStart(range, new Date()).toISOString())
    // Unfinished workouts were always excluded by every tab. It matters more
    // than it looks: 169 of this database's rows are abandoned starts.
    .not('end_time', 'is', null)
    .order('start_time', { ascending: true });

  if (error) throw error;
  return normalizeWorkouts((data ?? []) as unknown as RawWorkout[]);
}

export function invalidateWorkoutHistory(): void {
  cache.invalidate();
}

export function useWorkoutHistory(range: TimeRange) {
  const { user } = useAuth();
  const [data, setData] = useState<HistoryWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    cache
      .get(`${user.id}:${range}`, () => fetchHistory(user.id, range))
      .then((workouts) => {
        if (cancelled) return;
        setData(workouts);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.error('Error loading workout history:', e);
        setError(e instanceof Error ? e : new Error(String(e)));
        setData([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, range]);

  return { data, loading, error };
}
