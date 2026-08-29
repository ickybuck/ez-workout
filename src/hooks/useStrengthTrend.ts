import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  bestOneRepMax,
  canShowTrend,
  trendPercent,
  type OneRepMax,
  type TrendPoint,
} from '../lib/oneRepMax';

interface Row {
  weight: number | null;
  reps: number | null;
  failed_reps: number | null;
  extra_reps: number | null;
  workout_exercise: {
    exercise: { id: string; name: string } | null;
    workout: { user_id: string; start_time: string | null; end_time: string | null } | null;
  } | null;
}

export interface StrengthSeries {
  exerciseId: string;
  exerciseName: string;
  /**
   * Heaviest load actually lifted in the most recent session.
   *
   * A measured fact, and the reason it leads the display. Estimated 1RM assumes
   * a continuous set taken near failure, and this athlete deliberately clusters
   * heavy sets — squats as six, thirty seconds, then four. Ten clustered reps
   * are easier than ten straight, so the formula reads them as more strength
   * than they represent. Top-set load has no such assumption in it.
   */
  currentTopSet: number;
  /** Best estimate from the most recent session that produced one. */
  current: OneRepMax;
  /** Best across the whole window. */
  best: OneRepMax;
  bestDate: string;
  sessions: number;
  /** Null when there is not enough data to claim a direction. */
  changePercent: number | null;
  /** True when the current estimate is meaningfully below the best seen. */
  belowBest: boolean;
}

const DAYS: Record<string, number> = { '30': 30, '90': 90, '180': 180, all: 730 };

/**
 * Roughly the session-to-session noise on a 1RM under controlled conditions,
 * and optimistic for a gym. A current estimate within this of the best is not
 * a decline, it is the same number measured twice.
 */
const NOISE_BAND = 0.05;

/**
 * Estimated 1RM per exercise: where it is now, where it has been, and whether
 * there is enough evidence to say which way it is going.
 *
 * Kept apart from volume deliberately. Volume rises when a set is added and
 * conflates a heavy triple with a light twenty; this responds to load. Reading
 * the two as one is what put Push Upper at "flat" while every press in it sat
 * at a lifetime best.
 */
export function useStrengthTrend(timeRange: '30' | '90' | '180' | 'all') {
  const { user } = useAuth();
  const [series, setSeries] = useState<StrengthSeries[]>([]);
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
             exercise:exercise_id(id, name),
             workout:workout_id(user_id, start_time, end_time)
           )`,
        )
        .gte('created_at', since);

      if (cancelled) return;
      if (error || !data) {
        console.error('Could not load strength trend:', error);
        setLoading(false);
        return;
      }

      // Group sets by exercise and session date. Ownership and the finished
      // test are applied here rather than in the query, because both live on an
      // embedded resource where a failing filter silently stops filtering.
      const byExercise = new Map<
        string,
        { name: string; sessions: Map<string, Row[]> }
      >();

      for (const row of data as unknown as Row[]) {
        const exercise = row.workout_exercise?.exercise;
        const workout = row.workout_exercise?.workout;
        if (!exercise || !workout || workout.user_id !== user.id || !workout.end_time) continue;

        const date = (workout.start_time ?? '').slice(0, 10);
        if (!date) continue;

        const entry = byExercise.get(exercise.id) ?? { name: exercise.name, sessions: new Map() };
        entry.sessions.set(date, [...(entry.sessions.get(date) ?? []), row]);
        byExercise.set(exercise.id, entry);
      }

      const result: StrengthSeries[] = [];

      for (const [exerciseId, entry] of byExercise) {
        const points: TrendPoint[] = [];
        const topSetByDate = new Map<string, number>();

        for (const [date, rows] of entry.sessions) {
          // Heaviest completed set of the session, whatever its reps. Recorded
          // separately from the estimate because it survives clustering.
          const topSet = rows.reduce((max, r) => {
            const performed = (r.reps ?? 0) - (r.failed_reps ?? 0) + (r.extra_reps ?? 0);
            return performed > 0 ? Math.max(max, r.weight ?? 0) : max;
          }, 0);
          if (topSet > 0) topSetByDate.set(date, topSet);

          const estimate = bestOneRepMax(
            rows.map((r) => ({
              reps: r.reps,
              failed_reps: r.failed_reps,
              extra_reps: r.extra_reps,
              weight: r.weight,
            })),
          );
          if (estimate) points.push({ date, estimate });
        }

        if (points.length === 0) continue;

        const ordered = [...points].sort((a, b) => a.date.localeCompare(b.date));
        const current = ordered[ordered.length - 1].estimate;
        const peak = ordered.reduce((a, b) => (b.estimate.value > a.estimate.value ? b : a));

        result.push({
          exerciseId,
          exerciseName: entry.name,
          currentTopSet: topSetByDate.get(ordered[ordered.length - 1].date) ?? current.weight,
          current,
          best: peak.estimate,
          bestDate: peak.date,
          sessions: points.length,
          changePercent: canShowTrend(points) ? trendPercent(points) : null,
          belowBest: current.value < peak.estimate.value * (1 - NOISE_BAND),
        });
      }

      if (!cancelled) {
        setSeries(result.sort((a, b) => b.best.value - a.best.value));
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user, timeRange]);

  return { series, loading };
}
