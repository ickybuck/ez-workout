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
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!workout) {
    return null;
  }

  return (
    <div className="py-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <button
          onClick={() => navigate('/dashboard/history')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          <span className="text-sm">Back to History</span>
        </button>

        <div className="space-y-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{workout.name}</h2>
            <div className="text-sm text-gray-500">
              {format(new Date(workout.start_time), 'PPpp')}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-purple-100">
                <Dumbbell className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {workout.exercises.length} exercises
                </div>
                <div className="text-xs text-gray-500">
                  {calculateTotalReps()} total reps
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {formatDuration(workout.start_time, workout.end_time)}
                </div>
                <div className="text-xs text-gray-500">
                  Duration
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-100">
                <RotateCcw className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {formatWeight(calculateTotalVolume())}
                </div>
                <div className="text-xs text-gray-500">
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
                <h3 className="text-lg font-medium text-gray-900">
                  {exercise.exercise.name}
                </h3>
                <span className="text-xl" title={exercise.exercise.equipment_type.name}>
                  {exercise.exercise.equipment_type.emoji}
                </span>
                {workout.template_type === 'superset' && index % 2 === 0 && index < workout.exercises.length - 1 && (
                  <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                    Superset
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pl-2 pr-4 font-medium text-gray-500">#</th>
                      <th className="text-right py-2 px-4 font-medium text-gray-500">{unit}</th>
                      <th className="text-right py-2 px-4 font-medium text-gray-500">×</th>
                      <th className="text-right py-2 px-4 font-medium text-gray-500">done</th>
                      <th className="text-right py-2 pl-4 pr-2 font-medium text-gray-500">✓</th>
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
                              <span className="text-yellow-600">⚠️</span>
                            ) : (
                              <span className="text-emerald-600">✓</span>
                            )
                          ) : (
                            <span className="text-red-600">×</span>
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