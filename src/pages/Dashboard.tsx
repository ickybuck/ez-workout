import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Play, Plus, Star, Dumbbell } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { WorkoutTemplate } from '../types/template';
import { useActiveWorkout } from '../hooks/useActiveWorkout';
import { useWeightUnit } from '../hooks/useWeightUnit';

interface UserSettings {
  first_name: string | null;
  last_name: string | null;
  recent_workouts_count: number;
}

interface RecentWorkout {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  exercises: Array<{
    exercise: {
      id: string;
      name: string;
    };
    logs: Array<{
      completed: boolean;
      failed_reps: number;
      reps: number;
      weight: number;
    }>;
  }>;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { workout, setWorkout } = useActiveWorkout();
  const { formatVolume } = useWeightUnit();
  const [favoriteTemplates, setFavoriteTemplates] = useState<WorkoutTemplate[]>([]);
  const [hasTemplates, setHasTemplates] = useState<boolean>(true);
  const [recentWorkouts, setRecentWorkouts] = useState<RecentWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeDashboard = async () => {
      if (!user) return;

      try {
        // First load user settings
        const settings = await loadUserSettings();
        setUserSettings(settings);

        // Then load the rest in parallel
        await Promise.all([
          loadFavoriteTemplates(),
          loadRecentWorkouts(settings?.recent_workouts_count || 3),
          checkTemplates()
        ]);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
        setError(errorMessage);
        console.error('Dashboard initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeDashboard();
  }, [user]);

  // Auto-navigate to active workout if one exists (and it's not completed)
  useEffect(() => {
    if (workout && !workout.end_time && !loading) {
      navigate('/dashboard/workout');
    } else if (workout && workout.end_time) {
      // Clear completed workouts from state so dashboard content shows
      setWorkout(null);
    }
  }, [workout, loading, navigate]);

  const loadUserSettings = async () => {
    if (!user) throw new Error('No user found');

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('first_name, last_name, recent_workouts_count')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error loading user settings:', error);
      throw error;
    }
  };

  const checkTemplates = async () => {
    if (!user) return;

    try {
      const { count, error } = await supabase
        .from('workout_templates')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (error) throw error;
      setHasTemplates(count !== null && count > 0);
    } catch (error) {
      console.error('Error checking templates:', error);
      throw error;
    }
  };

  const loadRecentWorkouts = async (count: number = 3) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          id,
          name,
          start_time,
          end_time,
          exercises:workout_exercises(
            exercise:exercise_id(id, name),
            logs:exercise_logs(completed, failed_reps, reps, weight)
          )
        `)
        .eq('user_id', user.id)
        .not('end_time', 'is', null)
        .order('end_time', { ascending: false })
        .limit(count);

      if (error) throw error;
      setRecentWorkouts(data || []);
    } catch (error) {
      console.error('Error loading recent workouts:', error);
      throw error;
    }
  };

  const loadFavoriteTemplates = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('is_favorite', true)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFavoriteTemplates(data || []);
    } catch (error) {
      console.error('Error loading favorite templates:', error);
      throw error;
    }
  };

  const calculateWorkoutDuration = (start: string, end: string) => {
    const duration = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
    const durationMinutes = Math.floor(duration / 60);

    // Filter out unrealistic durations (over 5 hours)
    if (durationMinutes > 300) {
      return '—';
    }

    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    return [
      hours > 0 ? `${hours}h` : null,
      minutes > 0 ? `${minutes}m` : null,
    ].filter(Boolean).join(' ');
  };

  const calculateTotalVolume = (exercises: RecentWorkout['exercises']) => {
    return exercises.reduce((total, exercise) => {
      const exerciseVolume = exercise.logs.reduce((sum, log) => {
        if (log.completed) {
          return sum + (log.weight * (log.reps - log.failed_reps));
        }
        return sum;
      }, 0);
      return total + exerciseVolume;
    }, 0);
  };

  const getWelcomeMessage = () => {
    if (!userSettings) return 'Welcome back!';
    if (userSettings.first_name) {
      return `Welcome back, ${userSettings.first_name}!`;
    }
    return 'Welcome back!';
  };

  const handleExerciseClick = (exerciseId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    navigate(`/dashboard/exercises/${exerciseId}/edit`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-medium text-red-800 mb-2">Connection Error</h2>
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-2 py-2">
      <div className="bg-white rounded-lg shadow-md p-3">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{getWelcomeMessage()}</h1>

        {!workout && (
          <>
            {favoriteTemplates.length > 0 ? (
              <div className="mb-6">
                <div className="space-y-2">
                  {favoriteTemplates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => navigate(`/dashboard/workout?template=${template.id}`)}
                      className="group relative w-full text-left border rounded-lg p-3 hover:shadow-md transition-all duration-200 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-9 h-9 flex items-center justify-center rounded-full bg-indigo-100 group-hover:bg-indigo-200 transition-colors duration-200">
                            <Play className="h-4 w-4 text-indigo-600 group-hover:text-indigo-700" />
                          </div>
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 group-hover:text-indigo-900">
                            Start {template.name}
                          </h3>
                          {template.description && (
                            <p className="text-sm text-gray-600 group-hover:text-indigo-700 mt-0.5 line-clamp-2">
                              {template.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : !hasTemplates && (
              <div className="mb-6">
                <div className="text-center p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <div className="mx-auto w-10 h-10 flex items-center justify-center rounded-full bg-indigo-100 mb-3">
                    <Star className="h-5 w-5 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Get Started with Templates
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Create your first workout template or favorite an existing one to get started.
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => navigate('/dashboard/templates/new')}
                      className="flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create Template
                    </button>
                    <button
                      onClick={() => navigate('/dashboard/templates')}
                      className="flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Star className="h-4 w-4 mr-1" />
                      Browse Templates
                    </button>
                  </div>
                </div>
              </div>
            )}

            {recentWorkouts.length > 0 && (
              <>
                <h2 className="text-lg font-medium text-gray-900 mb-3">Recent Workouts</h2>
                <div className="space-y-3">
                  {recentWorkouts.map(workout => (
                    <div key={workout.id} className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 border-b">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-gray-900">{workout.name}</h3>
                          <span className="text-sm text-gray-500">
                            {format(new Date(workout.end_time), 'PPp')}
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-3 mt-1 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Dumbbell className="h-4 w-4" />
                            <span>{workout.exercises.length}</span>
                          </div>
                          <span>{calculateWorkoutDuration(workout.start_time, workout.end_time)}</span>
                          <span>{formatVolume(calculateTotalVolume(workout.exercises))} total</span>
                        </div>
                      </div>
                      
                      <div className="p-2 grid grid-cols-2 gap-1">
                        {workout.exercises.map((exercise) => {
                          const completedLogs = exercise.logs.filter(log => log.completed);
                          const partialLogs = exercise.logs.filter(log => log.completed && log.failed_reps > 0);
                          
                          const completed = exercise.logs.every(log => 
                            log.completed && log.failed_reps === 0
                          );
                          const failed = exercise.logs.some(log => 
                            !log.completed || log.failed_reps === log.reps
                          );

                          // Get the first log for rep/set info
                          const firstLog = exercise.logs[0];
                          const totalSets = exercise.logs.length;
                          const completedSets = completedLogs.length;
                          
                          return (
                            <div 
                              key={exercise.exercise.id}
                              className={`text-xs px-2 py-1 rounded flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity ${
                                completed 
                                  ? 'bg-green-50 text-green-700 hover:bg-green-100' 
                                  : failed 
                                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                    : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                              }`}
                              onClick={(e) => handleExerciseClick(exercise.exercise.id, e)}
                              title={`Click to edit ${exercise.exercise.name}`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">{exercise.exercise.name}</div>
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
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;