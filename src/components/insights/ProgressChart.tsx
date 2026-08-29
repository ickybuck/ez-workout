import React, { useMemo } from 'react';
import { LineChart, TrendingUp } from 'lucide-react';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { useWorkoutHistory } from '../../hooks/useWorkoutHistory';
import { calculateWorkoutVolume } from '../../lib/volumeUtils';

interface ProgressChartProps {
  timeRange: '30' | '90' | '180' | 'all';
}

interface DataPoint {
  date: string;
  volume: number;
  workouts: number;
}

const ProgressChart: React.FC<ProgressChartProps> = ({ timeRange }) => {
  const { unit, convertWeight } = useWeightUnit();
  const { data: workouts, loading } = useWorkoutHistory(timeRange);

  const data = useMemo<DataPoint[]>(() => {
    const groupedData: Record<string, { volume: number; count: number }> = {};

    workouts.forEach((workout) => {
      if (!workout.start_time) return;
      const date = new Date(workout.start_time).toISOString().split('T')[0];

      if (!groupedData[date]) {
        groupedData[date] = { volume: 0, count: 0 };
      }
      groupedData[date].volume += calculateWorkoutVolume(workout.workout_exercises ?? []);
      groupedData[date].count += 1;
    });

    return Object.entries(groupedData)
      .map(([date, stats]) => ({
        date,
        volume: Math.round(stats.volume),
        workouts: stats.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      // Most recent 30 points, for readability on a phone.
      .slice(-30);
  }, [workouts]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <LineChart className="h-5 w-5 text-blue-600" />
          Volume Progress
        </h3>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <LineChart className="h-5 w-5 text-blue-600" />
          Volume Progress
        </h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          No workout data available for this period
        </div>
      </div>
    );
  }

  const maxVolume = Math.max(...data.map(d => d.volume));
  const avgVolume = Math.round(data.reduce((sum, d) => sum + d.volume, 0) / data.length);

  const trend = data.length >= 2
    ? data[data.length - 1].volume > data[0].volume
      ? 'up'
      : data[data.length - 1].volume < data[0].volume
      ? 'down'
      : 'stable'
    : 'stable';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <LineChart className="h-5 w-5 text-blue-600" />
          Volume Progress
        </h3>
        <div className="flex items-center gap-2">
          <TrendingUp
            className={`h-5 w-5 ${
              trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-400'
            }`}
          />
          <span className="text-sm text-gray-600">Avg: {Math.round(convertWeight(avgVolume)).toLocaleString()} {unit}</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-8">
        <div className="flex items-end gap-2" style={{ minWidth: `${data.length * 32}px`, height: '240px' }}>
          {data.map((point, index) => {
            const heightPx = Math.max((point.volume / maxVolume) * 220, 8);
            return (
              <div key={point.date} className="flex flex-col items-center justify-end group relative" style={{ width: '28px', minWidth: '28px', height: '240px' }}>
                <div
                  className="w-full bg-blue-600 rounded-t hover:bg-blue-700 transition-colors cursor-pointer relative"
                  style={{ height: `${heightPx}px` }}
                >
                  <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap pointer-events-none z-10">
                    <div className="font-semibold">{new Date(point.date).toLocaleDateString()}</div>
                    <div>Volume: {Math.round(convertWeight(point.volume)).toLocaleString()} {unit}</div>
                    <div>Workouts: {point.workouts}</div>
                  </div>
                </div>
                <div className="text-[9px] text-gray-400 mt-1 absolute" style={{ bottom: '-20px' }}>
                  {new Date(point.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex justify-between text-xs text-gray-500">
        <span>{new Date(data[0].date).toLocaleDateString()}</span>
        <span>{new Date(data[data.length - 1].date).toLocaleDateString()}</span>
      </div>
    </div>
  );
};

export default ProgressChart;
