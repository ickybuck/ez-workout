import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { X, Undo2, CloudOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { workoutQueue } from '../lib/workoutSync';
import { useAuth } from '../contexts/AuthContext';
import { useActiveWorkout } from '../hooks/useActiveWorkout';
import { usePendingSync } from '../hooks/usePendingSync';
import { ActiveWorkout as ActiveWorkoutType } from '../types/workout';
import WorkoutTimer from '../components/workout/WorkoutTimer';
import RestTimer, { RestTimerRef } from '../components/workout/RestTimer';
import CurrentExercise from '../components/workout/CurrentExercise';
import ExerciseList from '../components/workout/ExerciseList';

interface UndoState {
  logId: string;
  previousCompleted: boolean;
  previousFailedReps: number;
}

const ActiveWorkout: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { 
    workout, 
    setWorkout, 
    currentExerciseIndex, 
    setCurrentExerciseIndex,
    activeExerciseIndex,
    setActiveExerciseIndex,
    getCurrentExercise, 
    getWorkoutDuration 
  } = useActiveWorkout();
  const [workoutTime, setWorkoutTime] = useState(0);
  const [exerciseTime, setExerciseTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [settings, setSettings] = useState({
    show_workout_timer: true,
    show_exercise_timer: true,
    rest_timer_duration: 90,
    auto_start_timer: true,
  });
  const restTimerRef = useRef<RestTimerRef>(null);
  const pendingSync = usePendingSync();

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('show_workout_timer, show_exercise_timer, rest_timer_duration, auto_start_timer')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading settings:', error);
        return;
      }

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  useEffect(() => {
    const templateId = searchParams.get('template');
    if (!workout && templateId) {
      startWorkout(templateId);
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!workout) return;

    const timer = setInterval(() => {
      setWorkoutTime(getWorkoutDuration());
      setExerciseTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [workout]);

  useEffect(() => {
    setExerciseTime(0);
    setUndoState(null); // Clear undo history when switching exercises
  }, [currentExerciseIndex]);

  const startWorkout = async (templateId: string) => {
    if (!user) {
      toast.error('Please log in to start a workout');
      navigate('/login');
      return;
    }

    try {
      // First get the template with exercises and their defaults
      const { data: template, error: templateError } = await supabase
        .from('workout_templates')
        .select(`
          *,
          exercises:template_exercises(
            id,
            order_index,
            default_sets,
            default_reps,
            default_weight,
            exercise:exercise_id(
              id,
              name,
              description,
              equipment_type:equipment_type_id(*),
              is_compound,
              is_plate_loaded
            )
          )
        `)
        .eq('id', templateId)
        .single();

      if (templateError) throw templateError;
      if (!template) throw new Error('Template not found');
      if (!template.exercises || template.exercises.length === 0) {
        toast.info('This template has no exercises. Add some exercises to get started.');
        navigate(`/dashboard/templates/${templateId}/edit`);
        return;
      }

      // Validate exercises data
      const validExercises = template.exercises.filter((te: any) => {
        if (!te || !te.exercise) {
          console.warn('Invalid exercise data in template:', te);
          return false;
        }
        return true;
      });

      if (validExercises.length === 0) {
        toast.error('No valid exercises found in template. Please check the template configuration.');
        navigate(`/dashboard/templates/${templateId}/edit`);
        return;
      }

      // Create the workout
      const { data: newWorkout, error: workoutError } = await supabase
        .from('workouts')
        .insert({
          user_id: user.id,
          template_id: templateId,
          name: template.name,
          start_time: new Date().toISOString(),
          template_type: template.template_type || 'regular',
        })
        .select()
        .single();

      if (workoutError) throw workoutError;
      if (!newWorkout) throw new Error('Failed to create workout');

      // Create workout exercises with proper null checks
      const workoutExercises = validExercises
        .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
        .map((te: any) => ({
          workout_id: newWorkout.id,
          exercise_id: te.exercise.id,
          order_index: te.order_index || 0,
        }));

      const { data: exercises, error: exercisesError } = await supabase
        .from('workout_exercises')
        .insert(workoutExercises)
        .select(`
          *,
          exercise:exercise_id(
            id,
            name,
            description,
            equipment_type:equipment_type_id(*),
            is_compound,
            is_plate_loaded
          )
        `);

      if (exercisesError) throw exercisesError;
      if (!exercises) throw new Error('Failed to create workout exercises');

      // Create exercise logs with proper null checks
      const logs = exercises.flatMap((we: any) => {
        if (!we || !we.exercise) return [];

        // Find the matching template exercise with null checks
        const templateExercise = template.exercises.find(
          (te: any) => te?.exercise?.id === we.exercise.id
        );
        if (!templateExercise) return [];

        const sets = templateExercise.default_sets || 3;
        const reps = templateExercise.default_reps || 10;
        const weight = templateExercise.default_weight || 0;

        return Array.from({ length: sets }, (_, i) => ({
          workout_exercise_id: we.id,
          set_number: i + 1,
          weight,
          reps,
          completed: false,
          failed_reps: 0,
          recommend_increase: false,
        }));
      });

      const { data: exerciseLogs, error: logsError } = await supabase
        .from('exercise_logs')
        .insert(logs)
        .select();

      if (logsError) throw logsError;
      if (!exerciseLogs) throw new Error('Failed to create exercise logs');

      const logsByExercise = exerciseLogs.reduce((acc: any, log: any) => {
        if (!acc[log.workout_exercise_id]) {
          acc[log.workout_exercise_id] = [];
        }
        acc[log.workout_exercise_id].push(log);
        return acc;
      }, {});

      const activeWorkout: ActiveWorkoutType = {
        ...newWorkout,
        exercises: exercises.map((we: any) => ({
          ...we,
          logs: logsByExercise[we.id] || [],
        })),
      };

      setWorkout(activeWorkout);
      setCurrentExerciseIndex(0);
      setActiveExerciseIndex(0);
    } catch (error: any) {
      console.error('Error starting workout:', error);
      toast.error(error.message || 'Failed to start workout');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSet = async (logId: string, partial?: { completedReps: number }) => {
    if (!workout || !user) return;

    try {
      const log = workout.exercises
        .flatMap(ex => ex.logs)
        .find(log => log.id === logId);

      if (!log) return;

      // Save undo state before making changes
      setUndoState({
        logId: log.id,
        previousCompleted: log.completed,
        previousFailedReps: log.failed_reps || 0,
      });

      const failedReps = partial ? log.reps - partial.completedReps : 0;

      // Queue the write instead of awaiting it, then update local state
      // unconditionally. Logging a set has to work on gym wifi, and the old
      // order — await, then update — dropped the set entirely when the
      // request failed. The queue is durable across reloads and retries on
      // reconnect; exercise_logs.id is the idempotency key.
      workoutQueue.enqueue({
        table: 'exercise_logs',
        rowId: logId,
        values: {
          completed: true,
          failed_reps: failedReps,
          updated_at: new Date().toISOString(),
        },
      });

      const updatedWorkout = {
        ...workout,
        exercises: workout.exercises.map(ex => ({
          ...ex,
          logs: ex.logs.map(log => 
            log.id === logId 
              ? { ...log, completed: true, failed_reps: failedReps }
              : log
          ),
        })),
      };
      setWorkout(updatedWorkout);

      // Reset and start the rest timer
      if (restTimerRef.current) {
        restTimerRef.current.resetTimer();
      }

      const currentExercise = updatedWorkout.exercises[currentExerciseIndex];
      const nextExercise = workout.template_type === 'superset' 
        ? updatedWorkout.exercises[currentExerciseIndex + 1] 
        : null;

      const currentComplete = currentExercise.logs.every(log => log.completed);
      const nextComplete = nextExercise 
        ? nextExercise.logs.every(log => log.completed)
        : true;

      if (workout.template_type === 'superset' && nextExercise) {
        const currentHasIncomplete = currentExercise.logs.some(log => !log.completed);
        const nextHasIncomplete = nextExercise.logs.some(log => !log.completed);
        
        if (currentHasIncomplete || nextHasIncomplete) {
          if (!currentHasIncomplete && nextHasIncomplete) {
            setActiveExerciseIndex(currentExerciseIndex + 1);
          }
          else if (currentHasIncomplete && !nextHasIncomplete) {
            setActiveExerciseIndex(currentExerciseIndex);
          }
          else {
            setActiveExerciseIndex(
              activeExerciseIndex === currentExerciseIndex 
                ? currentExerciseIndex + 1 
                : currentExerciseIndex
            );
          }
        }
      }

      if (currentComplete && nextComplete) {
        const nextIndex = workout.template_type === 'superset'
          ? currentExerciseIndex + 2
          : currentExerciseIndex + 1;

        if (nextIndex >= workout.exercises.length) {
          await endWorkout();
        } else {
          setCurrentExerciseIndex(nextIndex);
          setActiveExerciseIndex(nextIndex);
          setExerciseTime(0);
          toast.success('Moving to next exercise');
        }
      }

      toast.success(partial ? 'Partial set recorded' : 'Set completed!');
    } catch (error) {
      console.error('Error completing set:', error);
      toast.error('Failed to complete set');
    }
  };

  const endWorkout = async () => {
    if (!workout || !user) return;

    try {
      const endTime = new Date().toISOString();

      // Queued like the set writes. Finishing a workout in a basement with no
      // signal should still end it; the write goes out on reconnect.
      workoutQueue.enqueue({
        table: 'workouts',
        rowId: workout.id,
        values: {
          end_time: endTime,
          updated_at: endTime,
        },
      });

      // Update workout state with end_time so Dashboard doesn't redirect back
      setWorkout({
        ...workout,
        end_time: endTime,
        updated_at: endTime,
      });

      toast.success('Workout completed!');
      navigate('/dashboard/history');
    } catch (error) {
      console.error('Error ending workout:', error);
      toast.error('Failed to end workout');
    }
  };

  const handleUndoSet = async () => {
    if (!workout || !user || !undoState) return;

    try {
      // Coalesces with the completion this is undoing, so a complete/undo
      // pair while offline sends one write carrying the final state rather
      // than replaying both and depending on flush order.
      workoutQueue.enqueue({
        table: 'exercise_logs',
        rowId: undoState.logId,
        values: {
          completed: undoState.previousCompleted,
          failed_reps: undoState.previousFailedReps,
          updated_at: new Date().toISOString(),
        },
      });

      const updatedWorkout = {
        ...workout,
        exercises: workout.exercises.map(ex => ({
          ...ex,
          logs: ex.logs.map(log =>
            log.id === undoState.logId
              ? { ...log, completed: undoState.previousCompleted, failed_reps: undoState.previousFailedReps }
              : log
          ),
        })),
      };
      setWorkout(updatedWorkout);
      setUndoState(null);

      toast.success('Set undone');
    } catch (error) {
      console.error('Error undoing set:', error);
      toast.error('Failed to undo set');
    }
  };

  const deleteWorkout = async () => {
    if (!workout || !user) return;

    try {
      const { error } = await supabase
        .from('workouts')
        .delete()
        .eq('id', workout.id);

      if (error) throw error;

      setWorkout(null);
      toast.success('Workout deleted');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error deleting workout:', error);
      toast.error('Failed to delete workout');
    }
  };

  const handleJumpToExercise = async (targetIndex: number) => {
    if (!workout || !user) return;

    if (targetIndex === currentExerciseIndex) return;

    try {
      const isSuperset = workout.template_type === 'superset';

      if (isSuperset) {
        const currentPairIndex = Math.floor(currentExerciseIndex / 2);
        const targetPairIndex = Math.floor(targetIndex / 2);

        if (currentPairIndex === targetPairIndex) return;

        const exercises = [...workout.exercises];
        const currentPairStartIndex = currentPairIndex * 2;
        const targetPairStartIndex = targetPairIndex * 2;

        const currentExercise1 = exercises[currentPairStartIndex];
        const currentExercise2 = exercises[currentPairStartIndex + 1];
        const targetExercise1 = exercises[targetPairStartIndex];
        const targetExercise2 = exercises[targetPairStartIndex + 1];

        exercises[currentPairStartIndex] = targetExercise1;
        exercises[currentPairStartIndex + 1] = targetExercise2;
        exercises[targetPairStartIndex] = currentExercise1;
        exercises[targetPairStartIndex + 1] = currentExercise2;

        const updates = [
          { id: currentExercise1.id, order_index: targetPairStartIndex },
          { id: currentExercise2.id, order_index: targetPairStartIndex + 1 },
          { id: targetExercise1.id, order_index: currentPairStartIndex },
          { id: targetExercise2.id, order_index: currentPairStartIndex + 1 },
        ];

        for (const update of updates) {
          const { error } = await supabase
            .from('workout_exercises')
            .update({ order_index: update.order_index })
            .eq('id', update.id);

          if (error) throw error;
        }

        const updatedWorkout = {
          ...workout,
          exercises: exercises,
        };
        setWorkout(updatedWorkout);

        // Determine which exercise in the newly swapped-in pair should be active
        const newExercise1 = exercises[currentPairStartIndex];
        const newExercise2 = exercises[currentPairStartIndex + 1];

        const ex1CompletedCount = newExercise1.logs.filter(log => log.completed).length;
        const ex2CompletedCount = newExercise2.logs.filter(log => log.completed).length;

        // If neither exercise has any completed sets, start at the first exercise
        if (ex1CompletedCount === 0 && ex2CompletedCount === 0) {
          setActiveExerciseIndex(currentPairStartIndex);
        }
        // If exercise 1 has completed sets but exercise 2 doesn't, start at exercise 2
        else if (ex1CompletedCount > 0 && ex2CompletedCount === 0) {
          setActiveExerciseIndex(currentPairStartIndex + 1);
        }
        // Otherwise, determine based on which has fewer completed sets
        else {
          setActiveExerciseIndex(
            ex1CompletedCount <= ex2CompletedCount
              ? currentPairStartIndex
              : currentPairStartIndex + 1
          );
        }

        setExerciseTime(0);
        toast.success('Exercises swapped');

      } else {
        const exercises = [...workout.exercises];

        const currentExercise = exercises[currentExerciseIndex];
        const targetExercise = exercises[targetIndex];

        exercises[currentExerciseIndex] = targetExercise;
        exercises[targetIndex] = currentExercise;

        const updates = [
          { id: currentExercise.id, order_index: targetIndex },
          { id: targetExercise.id, order_index: currentExerciseIndex },
        ];

        for (const update of updates) {
          const { error } = await supabase
            .from('workout_exercises')
            .update({ order_index: update.order_index })
            .eq('id', update.id);

          if (error) throw error;
        }

        const updatedWorkout = {
          ...workout,
          exercises: exercises,
        };
        setWorkout(updatedWorkout);
        setExerciseTime(0);
        toast.success('Exercises swapped');
      }
    } catch (error) {
      console.error('Error swapping exercises:', error);
      toast.error('Failed to swap exercises');
    }
  };

  const currentExercise = getCurrentExercise();
  const nextExercise = workout?.template_type === 'superset' && workout.exercises[currentExerciseIndex + 1];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!workout) {
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-xl font-semibold text-gray-900 truncate">{workout.name}</h1>
              {pendingSync > 0 && (
                <span
                  className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                  title={`${pendingSync} change${pendingSync === 1 ? '' : 's'} will sync when you're back online. Nothing is lost.`}
                >
                  <CloudOff className="h-3 w-3" />
                  {pendingSync}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end gap-1">
                {settings.show_workout_timer && (
                  <WorkoutTimer
                    elapsedTime={workoutTime}
                    type="workout"
                    size="sm"
                  />
                )}
                {settings.show_exercise_timer && (
                  <WorkoutTimer
                    elapsedTime={exerciseTime}
                    type="exercise"
                    size="sm"
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                {undoState && (
                  <button
                    onClick={handleUndoSet}
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    title="Undo last set"
                  >
                    <Undo2 className="h-5 w-5" />
                  </button>
                )}
                <button
                  onClick={() => setShowQuitDialog(true)}
                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                  title="End workout"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
          <div className="mt-2">
            <RestTimer 
              ref={restTimerRef}
              defaultDuration={settings.rest_timer_duration} 
              autoStart={settings.auto_start_timer}
            />
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6">
        {currentExercise && (
          <div className="space-y-6">
            <CurrentExercise 
              exercise={currentExercise} 
              onCompleteSet={handleCompleteSet}
              isSuperset={workout.template_type === 'superset'}
              isActive={workout.template_type !== 'superset' || activeExerciseIndex === currentExerciseIndex}
            />
            {workout.template_type === 'superset' && nextExercise && (
              <CurrentExercise 
                exercise={nextExercise}
                onCompleteSet={handleCompleteSet}
                isSuperset={true}
                isActive={activeExerciseIndex === currentExerciseIndex + 1}
              />
            )}
          </div>
        )}
      </div>

      <ExerciseList
        exercises={workout.exercises}
        currentExerciseIndex={currentExerciseIndex}
        templateType={workout.template_type}
        onJumpToExercise={handleJumpToExercise}
      />

      {showQuitDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              End Workout?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Do you want to save your progress or delete this workout?
            </p>
            {undoState && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <button
                  onClick={() => {
                    handleUndoSet();
                    setShowQuitDialog(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 rounded-md transition-colors"
                >
                  <Undo2 className="h-4 w-4" />
                  Undo Last Set
                </button>
                <p className="text-xs text-blue-600 mt-2 text-center">
                  Accidentally recorded a set? Undo it before ending.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowQuitDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={deleteWorkout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
              >
                Delete
              </button>
              <button
                onClick={endWorkout}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
              >
                Save & End
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveWorkout;