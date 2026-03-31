import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Clock, Trash2, ArrowDownUp, ArrowRight, ChevronDown, ChevronUp, Info, Dumbbell } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useWeightUnit } from '../hooks/useWeightUnit';
import VolumeGraph, { VolumePoint } from '../components/workout/VolumeGraph';
import ConsistencyTracker from '../components/workout/ConsistencyTracker';

interface WorkoutHistory {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  template_type: 'regular' | 'superset';
  template_id: string | null;
  template: {
    category: 'Upper Body' | 'Lower Body' | 'Core Focused' | 'Whole Body';
  } | null;
  exercises: Array<{
    id: string;
    order_index: number;
    exercise: {
      name: string;
      equipment_type: {
        name: string;
        emoji: string;
      };
    };
    logs: Array<{
      completed: boolean;
      failed_reps: number;
      reps: number;
      weight: number;
    }>;
  }>;
}

interface UserSettings {
  show_volume_graph: boolean;
  show_consistency_tracker: boolean;
  weekly_workout_goal: number;
  goal_weekday_start: number;
}

const History: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { formatWeight } = useWeightUnit();
  const [workouts, setWorkouts] = useState<WorkoutHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [volumeData, setVolumeData] = useState<VolumePoint[]>([]);
  const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<UserSettings>({
    show_volume_graph: true,
    show_consistency_tracker: true,
    weekly_workout_goal: 3,
    goal_weekday_start: 0,
  });

  useEffect(() => {
    if (user) {
      loadWorkoutHistory();
      loadUserSettings();
    }
  }, [user]);

  const loadUserSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('show_volume_graph, show_consistency_tracker, weekly_workout_goal, goal_weekday_start')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  };

  const loadWorkoutHistory = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          *,
          template:template_id(category),
          exercises:workout_exercises(
            id,
            order_index,
            exercise:exercise_id(
              name,
              equipment_type:equipment_type_id(*)
            ),
            logs:exercise_logs(*)
          )
        `)
        .eq('user_id', user.id)
        .not('end_time', 'is', null)
        .order('end_time', { ascending: false });

      if (error) throw error;

      // Process and sort exercises
      const processedWorkouts = data.map(workout => ({
        ...workout,
        exercises: workout.exercises
          .sort((a, b) => a.order_index - b.order_index)
          .map(exercise => ({
            ...exercise,
            logs: exercise.logs.sort((a, b) => a.set_number - b.set_number),
          })),
      }));

      setWorkouts(processedWorkouts);

      // Process volume data for the graph
      const volumePoints = processedWorkouts.slice(0, 30).map(workout => {
        const workoutVolume = calculateTotalVolume(workout);
        const templateWorkouts = processedWorkouts.filter(w => w.template_id === workout.template_id && workout.template_id);
        const maxVolume = workout.template_id
          ? Math.max(...templateWorkouts.map(w => calculateTotalVolume(w)))
          : 0;
        const isPR = workout.template_id && workoutVolume === maxVolume && workoutVolume > 0;

        return {
          date: new Date(workout.end_time),
          volume: workoutVolume,
          templateId: workout.template_id,
          templateName: workout.name.replace(/ \(\d+\)$/, ''),
          category: workout.template?.category || 'Whole Body',
          isPR
        };
      }).reverse();

      setVolumeData(volumePoints);
    } catch (error) {
      console.error('Error loading workout history:', error);
      toast.error('Failed to load workout history');
    } finally {
      setLoading(false);
    }
  };

  const isPersonalBest = (workout: WorkoutHistory) => {
    if (!workout.template_id) return false;

    const workoutVolume = calculateTotalVolume(workout);
    const templateWorkouts = workouts.filter(w => w.template_id === workout.template_id);
    const maxVolume = Math.max(...templateWorkouts.map(w => calculateTotalVolume(w)));

    return workoutVolume === maxVolume && workoutVolume > 0;
  };

  const deleteWorkout = async (workoutId: string) => {
    if (!confirm('Are you sure you want to delete this workout? This action cannot be undone.')) {
      return;
    }

    setDeleting(workoutId);
    try {
      const { error } = await supabase
        .from('workouts')
        .delete()
        .eq('id', workoutId);

      if (error) throw error;

      setWorkouts(workouts.filter(w => w.id !== workoutId));
      toast.success('Workout deleted successfully');
    } catch (error) {
      console.error('Error deleting workout:', error);
      toast.error('Failed to delete workout');
    } finally {
      setDeleting(null);
    }
  };

  const formatDuration = (start: string, end: string) => {
    const duration = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);

    return [
      hours > 0 ? `${hours}h` : null,
      minutes > 0 ? `${minutes}m` : null,
    ].filter(Boolean).join(' ');
  };

  const calculateTotalVolume = (workout: WorkoutHistory) => {
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

  const toggleWorkoutExpanded = (workoutId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedWorkouts(prev => {
      const next = new Set(prev);
      if (next.has(workoutId)) {
        next.delete(workoutId);
      } else {
        next.add(workoutId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-2 py-2">
      <div className="bg-white rounded-lg shadow-md p-3">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Workout History</h2>

        {settings.show_consistency_tracker && (
          <ConsistencyTracker
            workouts={workouts}
            weeklyGoal={settings.weekly_workout_goal}
            weekdayStart={settings.goal_weekday_start}
          />
        )}

        {settings.show_volume_graph && volumeData.length > 0 && (
          <div className="mt-4">
            <VolumeGraph data={volumeData} />
          </div>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-900">Recent Workouts</h3>
            <span className="text-sm text-gray-500">{workouts.length}</span>
          </div>

          <div className="space-y-4">
            {workouts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No completed workouts yet
              </div>
            ) : (
              workouts.map(workout => {
                const isPR = isPersonalBest(workout);
                return (
                <div
                  key={workout.id}
                  className={`border rounded-lg hover:shadow-md transition-shadow duration-200 ${
                    isPR ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300' : ''
                  }`}
                >
                  <div 
                    className="p-3 cursor-pointer"
                    onClick={() => navigate(`/dashboard/workout/${workout.id}`)}
                  >
                    {/* First Row: Name and Type */}
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-medium text-gray-900 truncate max-w-[70%]">
                        {workout.name}
                      </h3>
                      <div className="flex items-center gap-3">
                        {workout.template_type === 'superset' && (
                          <div className="flex items-center gap-1 text-purple-600">
                            <ArrowDownUp className="h-4 w-4" />
                            <span className="text-sm">Superset</span>
                          </div>
                        )}
                        <button
                          onClick={(e) => toggleWorkoutExpanded(workout.id, e)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                        >
                          {expandedWorkouts.has(workout.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteWorkout(workout.id);
                          }}
                          disabled={deleting === workout.id}
                          className={`p-1.5 rounded-full ${
                            deleting === workout.id
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                          title="Delete workout"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Second Row: Stats */}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="font-medium text-gray-900">
                        {formatWeight(calculateTotalVolume(workout))}
                      </div>
                      <span className="text-gray-400">•</span>
                      <div>
                        {format(
                          new Date(workout.end_time),
                          new Date(workout.end_time).getFullYear() === new Date().getFullYear()
                            ? 'MMM d'
                            : 'MMM d, yyyy'
                        )}
                      </div>
                      {expandedWorkouts.has(workout.id) && (
                        <>
                          <span className="text-gray-400">•</span>
                          <div>{format(new Date(workout.end_time), 'p')}</div>
                        </>
                      )}
                      <span className="text-gray-400">•</span>
                      <div className="flex items-center gap-0.5">
                        <Clock className="h-4 w-4" />
                        <span>{formatDuration(workout.start_time, workout.end_time)}</span>
                      </div>
                      <span className="text-gray-400">•</span>
                      <div className="flex items-center gap-0.5">
                        <Dumbbell className="h-4 w-4" />
                        <span>{workout.exercises.length}</span>
                      </div>
                    </div>

                    {/* Exercise Grid - Only shown when expanded */}
                    {expandedWorkouts.has(workout.id) && (
                      <div className="mt-3 grid grid-cols-2 gap-1">
                        {workout.exercises.map((exercise) => {
                          const completedLogs = exercise.logs.filter(log => log.completed);
                          const failedLogs = exercise.logs.filter(log => !log.completed);
                          const partialLogs = exercise.logs.filter(log => log.completed && log.failed_reps > 0);
                          
                          const completed = exercise.logs.every(log => 
                            log.completed && log.failed_reps === 0
                          );
                          const failed = exercise.logs.some(log => 
                            !log.completed || log.failed_reps === log.reps
                          );

                          const firstLog = exercise.logs[0];
                          const totalSets = exercise.logs.length;
                          const completedSets = completedLogs.length;
                          
                          return (
                            <div 
                              key={exercise.id}
                              className={`text-xs px-2 py-1 rounded flex items-center justify-between ${
                                completed 
                                  ? 'bg-green-50 text-green-700' 
                                  : failed 
                                    ? 'bg-red-50 text-red-700'
                                    : 'bg-yellow-50 text-yellow-700'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate">{exercise.exercise.name}</div>
                                {partialLogs.length > 0 && (
                                  <div className="text-[10px] opacity-75">
                                    {partialLogs.map(log => `${log.reps - log.failed_reps}/${log.reps}`).join(', ')}
                                  </div>
                                )}
                              </div>
                              <div className="ml-2 tabular-nums whitespace-nowrap">
                                {completedSets}/{totalSets}×{firstLog.reps}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default History;