import React, { useState, useEffect, useMemo } from 'react';
import { Activity, Target, Calendar, TrendingUp, TrendingDown, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { useWorkoutHistory } from '../../hooks/useWorkoutHistory';
import { calculateLogVolume } from '../../lib/volumeUtils';
import MuscleBalance from '../../components/insights/MuscleBalance';
import StrengthProgress from '../../components/insights/StrengthProgress';

interface OverviewMetrics {
  totalWorkouts: number;
  totalVolume: number;
  avgWorkoutDuration: number;
  mostImprovedExercise: {
    name: string;
    improvement: number;
  } | null;
  workoutsThisWeek: number;
  workoutsLastWeek: number;
  weeklyGoal: number;
}

interface OverviewProps {
  timeRange: '30' | '90' | '180' | 'all';
}

const Overview: React.FC<OverviewProps> = ({ timeRange }) => {
  const { user } = useAuth();
  const { unit, convertWeight } = useWeightUnit();
  const { data: workouts, loading } = useWorkoutHistory(timeRange);
  const [weeklyGoal, setWeeklyGoal] = useState(3);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    supabase
      .from('user_settings')
      .select('weekly_workout_goal')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Error loading weekly goal:', error);
          return;
        }
        if (data?.weekly_workout_goal) setWeeklyGoal(data.weekly_workout_goal);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const metrics = useMemo<OverviewMetrics>(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(now.getDate() - 14);

    const startedAt = (w: { start_time: string | null }) =>
      w.start_time ? new Date(w.start_time) : null;

    const workoutsThisWeek = workouts.filter((w) => {
      const d = startedAt(w);
      return d !== null && d >= oneWeekAgo;
    }).length;

    const workoutsLastWeek = workouts.filter((w) => {
      const d = startedAt(w);
      return d !== null && d >= twoWeeksAgo && d < oneWeekAgo;
    }).length;

    let totalVolume = 0;
    let totalDuration = 0;
    let validWorkoutCount = 0;
    const exerciseProgress: Record<string, { name: string; volumes: number[] }> = {};

    workouts.forEach((workout) => {
      if (workout.start_time && workout.end_time) {
        const durationMinutes =
          (new Date(workout.end_time).getTime() - new Date(workout.start_time).getTime()) / 60000;

        // Ignore implausible durations: a workout left open overnight would
        // otherwise dominate the average.
        if (durationMinutes <= 300) {
          totalDuration += durationMinutes;
          validWorkoutCount++;
        }
      }

      workout.workout_exercises?.forEach((we) => {
        const exerciseVolume =
          we.exercise_logs?.reduce((sum, log) => sum + calculateLogVolume(log), 0) ?? 0;

        totalVolume += exerciseVolume;

        if (we.exercise) {
          if (!exerciseProgress[we.exercise.id]) {
            exerciseProgress[we.exercise.id] = { name: we.exercise.name, volumes: [] };
          }
          exerciseProgress[we.exercise.id].volumes.push(exerciseVolume);
        }
      });
    });

    let mostImproved: OverviewMetrics['mostImprovedExercise'] = null;
    let maxImprovement = 0;

    Object.values(exerciseProgress).forEach((data) => {
      if (data.volumes.length < 2) return;

      // The shared history is ordered OLDEST first. The previous version
      // fetched newest-first and took the leading slice as "recent"; keeping
      // that slice order here would silently invert this metric.
      const midpoint = Math.ceil(data.volumes.length / 2);
      const older = data.volumes.slice(0, midpoint);
      const recent = data.volumes.slice(midpoint);

      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      if (olderAvg <= 0) return;

      const improvement = ((recentAvg - olderAvg) / olderAvg) * 100;
      if (improvement > maxImprovement) {
        maxImprovement = improvement;
        mostImproved = { name: data.name, improvement: Math.round(improvement) };
      }
    });

    return {
      totalWorkouts: workouts.length,
      totalVolume: Math.round(totalVolume),
      avgWorkoutDuration: validWorkoutCount ? Math.round(totalDuration / validWorkoutCount) : 0,
      mostImprovedExercise: mostImproved,
      workoutsThisWeek,
      workoutsLastWeek,
      weeklyGoal,
    };
  }, [workouts, weeklyGoal]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  const weeklyProgress = (metrics.workoutsThisWeek / metrics.weeklyGoal) * 100;
  const weeklyChange = metrics.workoutsThisWeek - metrics.workoutsLastWeek;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-raised rounded-lg shadow-sm border border-edge p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-content-muted">Total Workouts</h3>
            <Activity className="h-5 w-5 text-accent" />
          </div>
          <p className="text-3xl font-bold text-content">{metrics.totalWorkouts}</p>
          <p className="text-sm text-content-subtle mt-1">
            {timeRange === 'all' ? 'All time' : `Last ${timeRange} days`}
          </p>
        </div>

        <div className="bg-surface-raised rounded-lg shadow-sm border border-edge p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-content-muted">Total Volume</h3>
            <Target className="h-5 w-5 text-positive" />
          </div>
          <p className="text-3xl font-bold text-content">{Math.round(convertWeight(metrics.totalVolume)).toLocaleString()}</p>
          <p className="text-sm text-content-subtle mt-1">{unit} lifted</p>
        </div>

        <div className="bg-surface-raised rounded-lg shadow-sm border border-edge p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-content-muted">Avg Duration</h3>
            <Calendar className="h-5 w-5 text-caution" />
          </div>
          <p className="text-3xl font-bold text-content">{metrics.avgWorkoutDuration}</p>
          <p className="text-sm text-content-subtle mt-1">minutes per workout</p>
        </div>

        <div className="bg-surface-raised rounded-lg shadow-sm border border-edge p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-content-muted">This Week</h3>
            {weeklyChange >= 0 ? (
              <TrendingUp className="h-5 w-5 text-positive" />
            ) : (
              <TrendingDown className="h-5 w-5 text-critical" />
            )}
          </div>
          <p className="text-3xl font-bold text-content">
            {metrics.workoutsThisWeek}/{metrics.weeklyGoal}
          </p>
          <div className="mt-2">
            <div className="w-full bg-surface-sunken rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  weeklyProgress >= 100 ? 'bg-positive' : 'bg-accent'
                }`}
                style={{ width: `${Math.min(weeklyProgress, 100)}%` }}
              />
            </div>
            <p className="text-sm text-content-subtle mt-1">
              {weeklyChange > 0 && `+${weeklyChange} from last week`}
              {weeklyChange === 0 && 'Same as last week'}
              {weeklyChange < 0 && `${weeklyChange} from last week`}
            </p>
          </div>
        </div>
      </div>

      {metrics.mostImprovedExercise && (
        <div className="bg-positive-soft rounded-lg shadow-sm border border-positive p-4">
          <div className="flex items-start gap-3">
            <Award className="h-6 w-6 text-positive flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-content mb-1">Most Improved Exercise</h3>
              <p className="text-content-muted">
                <span className="font-semibold">{metrics.mostImprovedExercise.name}</span> has improved by{' '}
                <span className="font-semibold text-positive">
                  {metrics.mostImprovedExercise.improvement}%
                </span>{' '}
                in volume over the selected period!
              </p>
            </div>
          </div>
        </div>
      )}

      <StrengthProgress timeRange={timeRange} />

      <MuscleBalance timeRange={timeRange} />
    </div>
  );
};

export default Overview;
