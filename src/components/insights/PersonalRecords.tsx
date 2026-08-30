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
      <div className="bg-surface-raised rounded-lg shadow-sm border border-edge p-4 mb-4">
        <h3 className="text-lg font-semibold text-content mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-caution" />
          Personal Records
        </h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="bg-surface-raised rounded-lg shadow-sm border border-edge p-4 mb-4">
        <h3 className="text-lg font-semibold text-content mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-caution" />
          Personal Records
        </h3>
        <div className="text-center py-5 text-content-subtle">
          No records found for this period. Keep working out to set new PRs!
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-raised rounded-lg shadow-sm border border-edge p-4 mb-4">
      <h3 className="text-lg font-semibold text-content mb-4 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-caution" />
        Personal Records
      </h3>
      <p className="text-content-muted mb-4">Your best performances (based on estimated 1RM):</p>

      <div className="space-y-2">
        {records.map((record, index) => {
          const estimatedMax = Math.round(record.weight * (1 + record.reps / 30));
          return (
            <div
              key={record.exerciseId}
              className={`flex items-start gap-3 p-3 rounded-lg ${
                index < 3
                  ? 'bg-caution-soft border border-caution'
                  : 'bg-surface border border-edge'
              }`}
            >
              {index < 3 ? (
                <Award className="h-5 w-5 text-caution flex-shrink-0" />
              ) : (
                <div className="h-5 w-5 flex items-center justify-center text-content-subtle font-semibold text-xs">
                  {index + 1}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="font-semibold text-content">{record.exerciseName}</h4>
                  <p className="text-xs text-content-subtle whitespace-nowrap">
                    {formatDistanceToNow(new Date(record.date), { addSuffix: true })}
                  </p>
                </div>
                <p className="text-sm text-content-muted">
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
