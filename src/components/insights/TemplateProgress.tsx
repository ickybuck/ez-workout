import React, { useEffect, useState } from 'react';
import { LayoutGrid as Layout, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { calculateWorkoutVolume } from '../../lib/volumeUtils';

interface TemplateProgressProps {
  timeRange: '30' | '90' | '180' | 'all';
}

interface TemplateStats {
  id: string;
  name: string;
  workoutCount: number;
  avgVolume: number;
  volumeTrend: 'up' | 'down' | 'stable';
  trendPercent: number;
  lastWorkout: string;
}

const TemplateProgress: React.FC<TemplateProgressProps> = ({ timeRange }) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TemplateStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTemplateProgress();
    }
  }, [user, timeRange]);

  const fetchTemplateProgress = async () => {
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

      const { data: workouts, error } = await supabase
        .from('workouts')
        .select(`
          id,
          template_id,
          start_time,
          workout_templates (
            id,
            name
          ),
          workout_exercises (
            exercise_logs (
              weight,
              reps,
              failed_reps,
              completed
            )
          )
        `)
        .eq('user_id', user.id)
        .not('template_id', 'is', null)
        .not('end_time', 'is', null)
        .gte('start_time', startDate.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;

      const templateData: Record<string, {
        name: string;
        volumes: number[];
        dates: string[];
      }> = {};

      (workouts || []).forEach((workout: any) => {
        if (!workout.template_id || !workout.workout_templates) return;

        const volume = calculateWorkoutVolume(workout.workout_exercises || []);

        if (!templateData[workout.template_id]) {
          templateData[workout.template_id] = {
            name: workout.workout_templates.name,
            volumes: [],
            dates: [],
          };
        }

        templateData[workout.template_id].volumes.push(volume);
        templateData[workout.template_id].dates.push(workout.start_time);
      });

      const templateStats: TemplateStats[] = Object.entries(templateData).map(([id, data]) => {
        const avgVolume = Math.round(data.volumes.reduce((a, b) => a + b, 0) / data.volumes.length);

        let volumeTrend: 'up' | 'down' | 'stable' = 'stable';
        let trendPercent = 0;

        if (data.volumes.length >= 2) {
          const midpoint = Math.ceil(data.volumes.length / 2);
          const recentAvg = data.volumes.slice(midpoint).reduce((a, b) => a + b, 0) / (data.volumes.length - midpoint);
          const olderAvg = data.volumes.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint;

          if (olderAvg > 0) {
            trendPercent = Math.round(((recentAvg - olderAvg) / olderAvg) * 100);
            if (trendPercent > 5) volumeTrend = 'up';
            else if (trendPercent < -5) volumeTrend = 'down';
          }
        }

        return {
          id,
          name: data.name,
          workoutCount: data.volumes.length,
          avgVolume,
          volumeTrend,
          trendPercent,
          lastWorkout: data.dates[data.dates.length - 1],
        };
      }).sort((a, b) => b.workoutCount - a.workoutCount);

      setTemplates(templateStats);
    } catch (error) {
      console.error('Error fetching template progress:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Layout className="h-5 w-5 text-blue-600" />
          Template Progress
        </h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Layout className="h-5 w-5 text-blue-600" />
          Template Progress
        </h3>
        <div className="text-center py-8 text-gray-500">
          No template-based workouts found for this period
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Layout className="h-5 w-5 text-blue-600" />
        Template Progress
      </h3>
      <p className="text-gray-600 mb-4">
        Track your performance across different workout templates:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template) => (
          <div
            key={template.id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-gray-900">{template.name}</h4>
                <p className="text-sm text-gray-600">
                  {template.workoutCount} workout{template.workoutCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {template.volumeTrend === 'up' && (
                  <div className="flex items-center gap-1 text-green-600">
                    <TrendingUp className="h-5 w-5" />
                    <span className="text-sm font-medium">+{template.trendPercent}%</span>
                  </div>
                )}
                {template.volumeTrend === 'down' && (
                  <div className="flex items-center gap-1 text-red-600">
                    <TrendingDown className="h-5 w-5" />
                    <span className="text-sm font-medium">{template.trendPercent}%</span>
                  </div>
                )}
                {template.volumeTrend === 'stable' && (
                  <div className="flex items-center gap-1 text-gray-500">
                    <Minus className="h-5 w-5" />
                    <span className="text-sm font-medium">Stable</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Avg Volume:</span>
                <span className="font-semibold text-gray-900">
                  {template.avgVolume.toLocaleString()} kg
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Last Workout:</span>
                <span className="font-semibold text-gray-900">
                  {new Date(template.lastWorkout).toLocaleDateString()}
                </span>
              </div>
            </div>

            {template.volumeTrend === 'up' && (
              <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                Great progress! Volume is trending upward.
              </div>
            )}
            {template.volumeTrend === 'down' && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                Volume is decreasing. Consider reviewing your approach.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TemplateProgress;
