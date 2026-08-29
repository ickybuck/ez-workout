import React, { useMemo } from 'react';
import { Award, Trophy } from 'lucide-react';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { useWorkoutHistory } from '../../hooks/useWorkoutHistory';
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
  const { formatWeight } = useWeightUnit();
  const { data: workouts, loading } = useWorkoutHistory(timeRange);

  const records = useMemo<PersonalRecord[]>(() => {
    const exerciseRecords: Record<string, PersonalRecord> = {};
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Epley one-rep max, so a heavy single and a lighter set of ten compare.
    const oneRepMax = (weight: number, reps: number) => weight * (1 + reps / 30);

    workouts.forEach((workout) => {
      workout.workout_exercises?.forEach((we) => {
        if (!we.exercise) return;
        const exercise = we.exercise;

        we.exercise_logs
          ?.filter((log) => log.completed)
          .forEach((log) => {
            const best = exerciseRecords[exercise.id];
            if (best && oneRepMax(log.weight, log.reps) <= oneRepMax(best.weight, best.reps)) return;

            exerciseRecords[exercise.id] = {
              exerciseId: exercise.id,
              exerciseName: exercise.name,
              weight: log.weight,
              reps: log.reps,
              date: log.created_at ?? '',
              isNew: log.created_at ? new Date(log.created_at) >= thirtyDaysAgo : false,
            };
          });
      });
    });

    return Object.values(exerciseRecords)
      .sort((a, b) => oneRepMax(b.weight, b.reps) - oneRepMax(a.weight, a.reps))
      .slice(0, 10);
  }, [workouts]);

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
