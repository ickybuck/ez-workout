import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Clock, Dumbbell, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useWeightUnit } from '../hooks/useWeightUnit';

interface WorkoutDetail {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  template_type: 'regular' | 'superset';
  exercises: Array<{
    id: string;
    order_index: number;
    exercise: {
      id: string;
      name: string;
      equipment_type: {
        id: string;
        name: string;
        emoji: string;
      };
    };
    logs: Array<{
      id: string;
      set_number: number;
      weight: number;
      reps: number;
      completed: boolean;
      failed_reps: number;
      recommend_increase: boolean;
    }>;
  }>;
}

const WorkoutDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { formatWeight, unit } = useWeightUnit();
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      loadWorkoutDetail();
    }
  }, [user, id]);

  const loadWorkoutDetail = async () => {
    // useParams types this as possibly undefined and it is right to: a
    // malformed route would otherwise send id=eq.undefined to PostgREST,
    // which fails as a bad request rather than as "not found".
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          *,
          exercises:workout_exercises(
            id,
            order_index,
            exercise:exercise_id(
              id,
              name,
              equipment_type:equipment_type_id(*)
            ),
            logs:exercise_logs(*)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      const processedWorkout = {
        ...data,
        exercises: data.exercises
          .sort((a, b) => a.order_index - b.order_index)
          .map(exercise => ({
            ...exercise,
            logs: exercise.logs.sort((a, b) => a.set_number - b.set_number),
          })),
      };

      setWorkout(processedWorkout);
    } catch (error) {
      console.error('Error loading workout detail:', error);
      toast.error('Failed to load workout');
      navigate('/dashboard/history');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (start: string, end: string) => {
    const duration = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    return [
      hours > 0 ? `${hours}h` : null,
      minutes > 0 ? `${minutes}m` : null,
      seconds > 0 ? `${seconds}s` : null,
    ].filter(Boolean).join(' ');
  };

  const calculateTotalVolume = () => {
    if (!workout) return 0;
    return workout.exercises.reduce((total, exercise) => {
      const exerciseVolume = exercise.logs.reduce((sum, log) => {
        if (log.completed) {
          return sum + (log.weight * (log.reps - log.failed_reps));
        }
        return sum;
      }, 0);
      return total + exerciseVolume;
    }, 0);
  };

  const calculateTotalReps = () => {
    if (!workout) return 0;
    return workout.exercises.reduce((total, exercise) => {
      const exerciseReps = exercise.logs.reduce((sum, log) => {
        if (log.completed) {
          return sum + (log.reps - log.failed_reps);
        }
        return sum;
      }, 0);
      return total + exerciseReps;
    }, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!workout) {
    return null;
  }

  return (
    <div className="py-8">
      <div className="bg-surface-raised rounded-lg shadow-md p-6">
        <button
          onClick={() => navigate('/dashboard/history')}
          className="flex items-center text-content-muted hover:text-content mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          <span className="text-sm">Back to History</span>
        </button>

        <div className="space-y-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-content">{workout.name}</h2>
            <div className="text-sm text-content-subtle">
              {format(new Date(workout.start_time), 'PPpp')}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-accent-soft">
                <Dumbbell className="h-4 w-4 text-accent-content" />
              </div>
              <div>
                <div className="text-sm font-medium text-content">
                  {workout.exercises.length} exercises
                </div>
                <div className="text-xs text-content-subtle">
                  {calculateTotalReps()} total reps
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-accent-soft">
                <Clock className="h-4 w-4 text-accent" />
              </div>
              <div>
                <div className="text-sm font-medium text-content">
                  {formatDuration(workout.start_time, workout.end_time)}
                </div>
                <div className="text-xs text-content-subtle">
                  Duration
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-positive-soft">
                <RotateCcw className="h-4 w-4 text-positive" />
              </div>
              <div>
                <div className="text-sm font-medium text-content">
                  {formatWeight(calculateTotalVolume())}
                </div>
                <div className="text-xs text-content-subtle">
                  Total volume
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {workout.exercises.map((exercise, index) => (
            <div key={exercise.id} className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-lg font-medium text-content">
                  {exercise.exercise.name}
                </h3>
                <span className="text-xl" title={exercise.exercise.equipment_type.name}>
                  {exercise.exercise.equipment_type.emoji}
                </span>
                {workout.template_type === 'superset' && index % 2 === 0 && index < workout.exercises.length - 1 && (
                  <span className="px-2 py-0.5 text-xs bg-accent-soft text-accent-content rounded-full">
                    Superset
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pl-2 pr-4 font-medium text-content-subtle">#</th>
                      <th className="text-right py-2 px-4 font-medium text-content-subtle">{unit}</th>
                      <th className="text-right py-2 px-4 font-medium text-content-subtle">×</th>
                      <th className="text-right py-2 px-4 font-medium text-content-subtle">done</th>
                      <th className="text-right py-2 pl-4 pr-2 font-medium text-content-subtle">✓</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {exercise.logs.map(log => (
                      <tr key={log.id}>
                        <td className="py-2 pl-2 pr-4">{log.set_number}</td>
                        <td className="text-right py-2 px-4">{formatWeight(log.weight, false)}</td>
                        <td className="text-right py-2 px-4">{log.reps}</td>
                        <td className="text-right py-2 px-4">
                          {log.completed ? log.reps - log.failed_reps : '-'}
                        </td>
                        <td className="text-right py-2 pl-4 pr-2">
                          {log.completed ? (
                            log.failed_reps > 0 ? (
                              <span className="text-caution">⚠️</span>
                            ) : (
                              <span className="text-positive">✓</span>
                            )
                          ) : (
                            <span className="text-critical">×</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkoutDetail;