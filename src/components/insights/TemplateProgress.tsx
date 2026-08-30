import React, { useMemo } from 'react';
import { LayoutGrid as Layout, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useWorkoutHistory } from '../../hooks/useWorkoutHistory';
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
  const { data: workouts, loading } = useWorkoutHistory(timeRange);

  const templates = useMemo<TemplateStats[]>(() => {
    const templateData: Record<string, { name: string; volumes: number[]; dates: string[] }> = {};

    workouts.forEach((workout) => {
      // Template-less workouts are excluded here rather than in the query,
      // because the fetch is now shared with tabs that do want them.
      if (!workout.template_id || !workout.workout_templates || !workout.start_time) return;

      if (!templateData[workout.template_id]) {
        templateData[workout.template_id] = {
          name: workout.workout_templates.name,
          volumes: [],
          dates: [],
        };
      }

      templateData[workout.template_id].volumes.push(
        calculateWorkoutVolume(workout.workout_exercises ?? []),
      );
      templateData[workout.template_id].dates.push(workout.start_time);
    });

    return Object.entries(templateData)
      .map(([id, data]) => {
        const avgVolume = Math.round(data.volumes.reduce((a, b) => a + b, 0) / data.volumes.length);

        let volumeTrend: 'up' | 'down' | 'stable' = 'stable';
        let trendPercent = 0;

        // Split the range in half and compare averages, so a template with a
        // handful of sessions still reports a direction.
        if (data.volumes.length >= 2) {
          const midpoint = Math.ceil(data.volumes.length / 2);
          const recentAvg =
            data.volumes.slice(midpoint).reduce((a, b) => a + b, 0) / (data.volumes.length - midpoint);
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
      })
      .sort((a, b) => b.workoutCount - a.workoutCount);
  }, [workouts]);

  if (loading) {
    return (
      <div className="bg-surface-raised rounded-lg shadow-sm border border-edge p-4 mb-4">
        <h3 className="text-lg font-semibold text-content mb-4 flex items-center gap-2">
          <Layout className="h-5 w-5 text-accent" />
          Template Progress
        </h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
        </div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="bg-surface-raised rounded-lg shadow-sm border border-edge p-4 mb-4">
        <h3 className="text-lg font-semibold text-content mb-4 flex items-center gap-2">
          <Layout className="h-5 w-5 text-accent" />
          Template Progress
        </h3>
        <div className="text-center py-5 text-content-subtle">
          No template-based workouts found for this period
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-raised rounded-lg shadow-sm border border-edge p-4 mb-4">
      <h3 className="text-lg font-semibold text-content mb-4 flex items-center gap-2">
        <Layout className="h-5 w-5 text-accent" />
        Template Progress
      </h3>
      <p className="text-content-muted mb-4">
        Track your performance across different workout templates:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template) => (
          <div
            key={template.id}
            className="border border-edge rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-content">{template.name}</h4>
                <p className="text-sm text-content-muted">
                  {template.workoutCount} workout{template.workoutCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {template.volumeTrend === 'up' && (
                  <div className="flex items-center gap-1 text-positive">
                    <TrendingUp className="h-5 w-5" />
                    <span className="text-sm font-medium">+{template.trendPercent}%</span>
                  </div>
                )}
                {template.volumeTrend === 'down' && (
                  <div className="flex items-center gap-1 text-critical">
                    <TrendingDown className="h-5 w-5" />
                    <span className="text-sm font-medium">{template.trendPercent}%</span>
                  </div>
                )}
                {template.volumeTrend === 'stable' && (
                  <div className="flex items-center gap-1 text-content-subtle">
                    <Minus className="h-5 w-5" />
                    <span className="text-sm font-medium">Stable</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-content-muted">Avg Volume:</span>
                <span className="font-semibold text-content">
                  {template.avgVolume.toLocaleString()} kg
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-content-muted">Last Workout:</span>
                <span className="font-semibold text-content">
                  {new Date(template.lastWorkout).toLocaleDateString()}
                </span>
              </div>
            </div>

            {template.volumeTrend === 'up' && (
              <div className="mt-3 p-2 bg-positive-soft border border-positive rounded text-xs text-positive-content">
                Great progress! Volume is trending upward.
              </div>
            )}
            {template.volumeTrend === 'down' && (
              <div className="mt-3 p-2 bg-critical-soft border border-critical rounded text-xs text-critical-content">
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
