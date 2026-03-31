import React, { useEffect, useState } from 'react';
import { Award, Trophy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { formatDistanceToNow } from 'date-fns';

interface PersonalRecordsProps {
  timeRange: '30' | '90' | '180' | 'all';
}

interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  date: string;
  isNew: boolean;
}

const PersonalRecords: React.FC<PersonalRecordsProps> = ({ timeRange }) => {
  const { user } = useAuth();
  const { unit, formatWeight } = useWeightUnit();
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPersonalRecords();
    }
  }, [user, timeRange]);

  const fetchPersonalRecords = async () => {
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
            exercise:exercises (
              id,
              name
            ),
            exercise_logs (
              weight,
              reps,
              completed,
              created_at
            )
          )
        `)
        .eq('user_id', user.id)
        .gte('start_time', startDate.toISOString())
        .not('end_time', 'is', null)
        .order('start_time', { ascending: true });

      if (error) throw error;

      const exerciseRecords: Record<string, PersonalRecord> = {};

      (workouts || []).forEach((workout: any) => {
        workout.workout_exercises?.forEach((we: any) => {
          if (!we.exercise) return;

          const completedLogs = we.exercise_logs?.filter((log: any) => log.completed) || [];

          completedLogs.forEach((log: any) => {
            const oneRepMax = log.weight * (1 + log.reps / 30);

            if (
              !exerciseRecords[we.exercise.id] ||
              oneRepMax > (exerciseRecords[we.exercise.id].weight * (1 + exerciseRecords[we.exercise.id].reps / 30))
            ) {
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              const isNew = new Date(log.created_at) >= thirtyDaysAgo;

              exerciseRecords[we.exercise.id] = {
                exerciseId: we.exercise.id,
                exerciseName: we.exercise.name,
                weight: log.weight,
                reps: log.reps,
                date: log.created_at,
                isNew,
              };
            }
          });
        });
      });

      const recordsList = Object.values(exerciseRecords).sort((a, b) => {
        const aScore = a.weight * (1 + a.reps / 30);
        const bScore = b.weight * (1 + b.reps / 30);
        return bScore - aScore;
      });

      setRecords(recordsList.slice(0, 10));
    } catch (error) {
      console.error('Error fetching personal records:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-600" />
          Personal Records
        </h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-600" />
          Personal Records
        </h3>
        <div className="text-center py-8 text-gray-500">
          No records found for this period. Keep working out to set new PRs!
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-yellow-600" />
        Personal Records
      </h3>
      <p className="text-gray-600 mb-4">Your best performances (based on estimated 1RM):</p>

      <div className="space-y-2">
        {records.map((record, index) => {
          const estimatedMax = Math.round(record.weight * (1 + record.reps / 30));
          return (
            <div
              key={record.exerciseId}
              className={`flex items-start gap-3 p-3 rounded-lg ${
                index < 3
                  ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200'
                  : 'bg-gray-50 border border-gray-200'
              }`}
            >
              {index < 3 ? (
                <Award className="h-5 w-5 text-yellow-600 flex-shrink-0" />
              ) : (
                <div className="h-5 w-5 flex items-center justify-center text-gray-400 font-semibold text-xs">
                  {index + 1}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="font-semibold text-gray-900">{record.exerciseName}</h4>
                  <p className="text-xs text-gray-500 whitespace-nowrap">
                    {formatDistanceToNow(new Date(record.date), { addSuffix: true })}
                  </p>
                </div>
                <p className="text-sm text-gray-600">
                  {formatWeight(record.weight)} × {record.reps} reps • Est. 1RM: {formatWeight(estimatedMax)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PersonalRecords;
