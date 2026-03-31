import React, { useState, useEffect } from 'react';
import { Activity, Target, Calendar, TrendingUp, TrendingDown, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { toast } from 'sonner';
import { calculateLogVolume } from '../../lib/volumeUtils';

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
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<OverviewMetrics>({
    totalWorkouts: 0,
    totalVolume: 0,
    avgWorkoutDuration: 0,
    mostImprovedExercise: null,
    workoutsThisWeek: 0,
    workoutsLastWeek: 0,
    weeklyGoal: 3,
  });

  useEffect(() => {
    if (user) {
      fetchMetrics();
    }
  }, [user, timeRange]);

  const fetchMetrics = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const now = new Date();
      let startDate = new Date();

      if (timeRange === '30') {
        startDate.setDate(now.getDate() - 30);
      } else if (timeRange === '90') {
        startDate.setDate(now.getDate() - 90);
      } else if (timeRange === '180') {
        startDate.setDate(now.getDate() - 180);
      } else {
        startDate = new Date(0);
      }

      const { data: workouts, error: workoutsError } = await supabase
        .from('workouts')
        .select(`
          id,
          start_time,
          end_time,
          workout_exercises (
            id,
            exercise:exercises (
              id,
              name
            ),
            exercise_logs (
              weight,
              reps,
              failed_reps,
              completed
            )
          )
        `)
        .eq('user_id', user.id)
        .gte('start_time', startDate.toISOString())
        .not('end_time', 'is', null)
        .order('start_time', { ascending: false });

      if (workoutsError) throw workoutsError;

      const { data: settings } = await supabase
        .from('user_settings')
        .select('weekly_workout_goal')
        .eq('user_id', user.id)
        .single();

      const weeklyGoal = settings?.weekly_workout_goal || 3;

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(now.getDate() - 14);

      const workoutsThisWeek = (workouts || []).filter(
        w => new Date(w.start_time) >= oneWeekAgo
      ).length;

      const workoutsLastWeek = (workouts || []).filter(
        w => new Date(w.start_time) >= twoWeeksAgo && new Date(w.start_time) < oneWeekAgo
      ).length;

      let totalVolume = 0;
      let totalDuration = 0;
      let validWorkoutCount = 0;
      const exerciseProgress: Record<string, { name: string; volumes: number[] }> = {};

      (workouts || []).forEach((workout: any) => {
        if (workout.start_time && workout.end_time) {
          const duration = new Date(workout.end_time).getTime() - new Date(workout.start_time).getTime();
          const durationMinutes = duration / 60000;

          // Only include workouts with realistic durations (under 5 hours)
          if (durationMinutes <= 300) {
            totalDuration += durationMinutes;
            validWorkoutCount++;
          }
        }

        workout.workout_exercises?.forEach((we: any) => {
          const exerciseVolume = we.exercise_logs
            ?.reduce((sum: number, log: any) => sum + calculateLogVolume(log), 0) || 0;

          totalVolume += exerciseVolume;

          if (we.exercise) {
            if (!exerciseProgress[we.exercise.id]) {
              exerciseProgress[we.exercise.id] = {
                name: we.exercise.name,
                volumes: [],
              };
            }
            exerciseProgress[we.exercise.id].volumes.push(exerciseVolume);
          }
        });
      });

      let mostImproved = null;
      let maxImprovement = 0;

      Object.entries(exerciseProgress).forEach(([id, data]) => {
        if (data.volumes.length >= 2) {
          const recent = data.volumes.slice(0, Math.ceil(data.volumes.length / 2));
          const older = data.volumes.slice(Math.ceil(data.volumes.length / 2));

          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

          if (olderAvg > 0) {
            const improvement = ((recentAvg - olderAvg) / olderAvg) * 100;
            if (improvement > maxImprovement) {
              maxImprovement = improvement;
              mostImproved = {
                name: data.name,
                improvement: Math.round(improvement),
              };
            }
          }
        }
      });

      setMetrics({
        totalWorkouts: workouts?.length || 0,
        totalVolume: Math.round(totalVolume),
        avgWorkoutDuration: validWorkoutCount ? Math.round(totalDuration / validWorkoutCount) : 0,
        mostImprovedExercise: mostImproved,
        workoutsThisWeek,
        workoutsLastWeek,
        weeklyGoal,
      });
    } catch (error: any) {
      console.error('Error fetching metrics:', error);
      toast.error('Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const weeklyProgress = (metrics.workoutsThisWeek / metrics.weeklyGoal) * 100;
  const weeklyChange = metrics.workoutsThisWeek - metrics.workoutsLastWeek;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Workouts</h3>
            <Activity className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{metrics.totalWorkouts}</p>
          <p className="text-sm text-gray-500 mt-1">
            {timeRange === 'all' ? 'All time' : `Last ${timeRange} days`}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Volume</h3>
            <Target className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{Math.round(convertWeight(metrics.totalVolume)).toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">{unit} lifted</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Avg Duration</h3>
            <Calendar className="h-5 w-5 text-orange-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{metrics.avgWorkoutDuration}</p>
          <p className="text-sm text-gray-500 mt-1">minutes per workout</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">This Week</h3>
            {weeklyChange >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {metrics.workoutsThisWeek}/{metrics.weeklyGoal}
          </p>
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  weeklyProgress >= 100 ? 'bg-green-600' : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(weeklyProgress, 100)}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {weeklyChange > 0 && `+${weeklyChange} from last week`}
              {weeklyChange === 0 && 'Same as last week'}
              {weeklyChange < 0 && `${weeklyChange} from last week`}
            </p>
          </div>
        </div>
      </div>

      {metrics.mostImprovedExercise && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg shadow-sm border border-green-200 p-6">
          <div className="flex items-start gap-3">
            <Award className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Most Improved Exercise</h3>
              <p className="text-gray-700">
                <span className="font-semibold">{metrics.mostImprovedExercise.name}</span> has improved by{' '}
                <span className="font-semibold text-green-600">
                  {metrics.mostImprovedExercise.improvement}%
                </span>{' '}
                in volume over the selected period!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Overview;
