import React, { useEffect, useState } from 'react';
import { BarChart3, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { calculateWorkoutVolume } from '../../lib/volumeUtils';

interface VolumeAnalysisProps {
  timeRange: '30' | '90' | '180' | 'all';
}

interface DayVolume {
  day: string;
  volume: number;
  count: number;
}

const VolumeAnalysis: React.FC<VolumeAnalysisProps> = ({ timeRange }) => {
  const { user } = useAuth();
  const { unit, convertWeight } = useWeightUnit();
  const [dayVolumes, setDayVolumes] = useState<DayVolume[]>([]);
  const [loading, setLoading] = useState(true);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    if (user) {
      fetchVolumeAnalysis();
    }
  }, [user, timeRange]);

  const fetchVolumeAnalysis = async () => {
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
          start_time,
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
        .gte('start_time', startDate.toISOString())
        .not('end_time', 'is', null);

      if (error) throw error;

      const dayData: Record<number, { volume: number; count: number }> = {};

      for (let i = 0; i < 7; i++) {
        dayData[i] = { volume: 0, count: 0 };
      }

      (workouts || []).forEach((workout: any) => {
        const dayOfWeek = new Date(workout.start_time).getDay();
        const volume = calculateWorkoutVolume(workout.workout_exercises || []);

        dayData[dayOfWeek].volume += volume;
        dayData[dayOfWeek].count += 1;
      });

      const volumes = Object.entries(dayData).map(([day, data]) => ({
        day: dayNames[parseInt(day)],
        volume: data.count > 0 ? Math.round(data.volume / data.count) : 0,
        count: data.count,
      }));

      setDayVolumes(volumes);
    } catch (error) {
      console.error('Error fetching volume analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-green-600" />
          Volume by Day
        </h3>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const maxVolume = Math.max(...dayVolumes.map(d => d.volume), 1);
  const mostProductiveDay = dayVolumes.reduce((max, day) =>
    day.volume > max.volume ? day : max
  , dayVolumes[0]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-green-600" />
        Volume by Day of Week
      </h3>

      {mostProductiveDay.count > 0 && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-700">
              <span className="font-semibold">{mostProductiveDay.day}</span> is your most productive day
              with an average of <span className="font-semibold">{Math.round(convertWeight(mostProductiveDay.volume)).toLocaleString()} {unit}</span>
            </span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {dayVolumes.map((dayData) => {
          const percentage = maxVolume > 0 ? (dayData.volume / maxVolume) * 100 : 0;
          const isMaxDay = dayData.volume === mostProductiveDay.volume && dayData.count > 0;

          return (
            <div key={dayData.day} className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className={`font-medium ${isMaxDay ? 'text-green-700' : 'text-gray-700'}`}>
                  {dayData.day}
                </span>
                <span className="text-gray-600">
                  {dayData.count > 0 ? (
                    <>
                      {Math.round(convertWeight(dayData.volume)).toLocaleString()} {unit}
                      <span className="text-gray-400 ml-1">({dayData.count}x)</span>
                    </>
                  ) : (
                    <span className="text-gray-400">No data</span>
                  )}
                </span>
              </div>
              <div className="max-w-md bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    isMaxDay ? 'bg-green-600' : 'bg-blue-600'
                  }`}
                  style={{ width: `${percentage}%`, minWidth: dayData.count > 0 ? '2%' : '0%' }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Average volume per workout shown for each day of the week
        </p>
      </div>
    </div>
  );
};

export default VolumeAnalysis;
