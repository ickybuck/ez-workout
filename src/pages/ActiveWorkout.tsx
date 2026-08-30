import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { X, Undo2, CloudOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { workoutQueue } from '../lib/workoutSync';
import { useAuth } from '../contexts/AuthContext';
import { useActiveWorkout } from '../hooks/useActiveWorkout';
import { usePendingSync } from '../hooks/usePendingSync';
import type { SetOutcomeInput } from '../lib/stopReason';
import { runIndexes, normalise } from '../lib/supersets';
import { useCleanStalls } from '../hooks/useCleanStalls';
import { ActiveWorkout as ActiveWorkoutType } from '../types/workout';
import WorkoutTimer from '../components/workout/WorkoutTimer';
import RestTimer, { RestTimerRef } from '../components/workout/RestTimer';
import CurrentExercise from '../components/workout/CurrentExercise';
import ExerciseList from '../components/workout/ExerciseList';

interface UndoState {
  logId: string;
  previousCompleted: boolean;
  previousFailedReps: number;
  // Every field the completion writes has to be captured here, or undo
  // restores a row that is half old and half new. Because the offline queue
  // coalesces, a partial restore merges over the completion and leaves, say, a
  // stop_reason attached to a set that is no longer completed.
  previousExtraReps: number;
  previousStopReason: string | null;
  previousSetRir: string | null;
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

  // Scoped to this workout's exercises. Across the whole library this fires on
  // fourteen lifts at once, several with runs past twenty sessions — useful as
  // a list, useless as fourteen simultaneous nudges.
  const cleanStalls = useCleanStalls(
    workout?.exercises.map((exercise) => exercise.exercise.id) ?? [],
    user?.id,
  );

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
            superset_group,
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
          // Snapshot the pairing, so revising a template later cannot change
          // the shape of a session already recorded against the old one.
          superset_group: te.superset_group ?? null,
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

  const handleCompleteSet = async (logId: string, outcome?: SetOutcomeInput) => {
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
        previousExtraReps: log.extra_reps ?? 0,
        previousStopReason: log.stop_reason ?? null,
        previousSetRir: log.set_rir ?? null,
      });

      const failedReps =
        outcome?.completedReps !== undefined ? log.reps - outcome.completedReps : 0;
      const extraReps = outcome?.extraReps ?? 0;

      // A null is written as null, never as a zero or a guess. "Not recorded"
      // has to stay distinguishable from "recorded as none", because the whole
      // point of these columns is that the seventeen months behind them cannot
      // be interpreted and must not be imitated.
      const stopReason = outcome?.stopReason ?? null;
      const setRir = outcome?.setRir ?? null;

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
          extra_reps: extraReps,
          stop_reason: stopReason,
          set_rir: setRir,
          updated_at: new Date().toISOString(),
        },
      });

      const updatedWorkout = {
        ...workout,
        exercises: workout.exercises.map(ex => ({
          ...ex,
          logs: ex.logs.map(log =>
            log.id === logId
              ? {
                  ...log,
                  completed: true,
                  failed_reps: failedReps,
                  extra_reps: extraReps,
                  stop_reason: stopReason,
                  set_rir: setRir,
                }
              : log
          ),
        })),
      };
      setWorkout(updatedWorkout);

      // Reset and start the rest timer
      if (restTimerRef.current) {
        restTimerRef.current.resetTimer();
      }

      // Advance by block rather than by pair. A block is a run of exercises
      // sharing a superset group, or a single exercise on its own — so the same
      // code drives a straight set, a pair and a triple, where the old version
      // could only ever step one or two.
      const runs = runIndexes(updatedWorkout.exercises);
      const currentRun = runs[currentExerciseIndex];
      const blockPositions = runs.reduce<number[]>(
        (acc, run, i) => (run === currentRun ? [...acc, i] : acc),
        [],
      );

      const isDone = (i: number) => updatedWorkout.exercises[i].logs.every(log => log.completed);
      const blockComplete = blockPositions.every(isDone);

      if (!blockComplete) {
        // Hand over to the next exercise in the block that still has work,
        // wrapping around so a pair alternates exactly as it always has.
        const from = blockPositions.indexOf(activeExerciseIndex);
        const ordered = [...blockPositions.slice(from + 1), ...blockPositions.slice(0, from + 1)];
        const nextActive = ordered.find((i) => !isDone(i));
        if (nextActive !== undefined) setActiveExerciseIndex(nextActive);
      } else {
        const nextIndex = blockPositions[blockPositions.length - 1] + 1;

        if (nextIndex >= updatedWorkout.exercises.length) {
          await endWorkout();
        } else {
          setCurrentExerciseIndex(nextIndex);
          setActiveExerciseIndex(nextIndex);
          setExerciseTime(0);
          toast.success('Moving to next exercise');
        }
      }

      toast.success(
        extraReps > 0
          ? `Set completed, +${extraReps} past target`
          : failedReps > 0
            ? 'Partial set recorded'
            : 'Set completed!',
      );
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
          extra_reps: undoState.previousExtraReps,
          stop_reason: undoState.previousStopReason,
          set_rir: undoState.previousSetRir,
          updated_at: new Date().toISOString(),
        },
      });

      const updatedWorkout = {
        ...workout,
        exercises: workout.exercises.map(ex => ({
          ...ex,
          logs: ex.logs.map(log =>
            log.id === undoState.logId
              ? {
                  ...log,
                  completed: undoState.previousCompleted,
                  failed_reps: undoState.previousFailedReps,
                  extra_reps: undoState.previousExtraReps,
                  stop_reason: undoState.previousStopReason,
                  set_rir: undoState.previousSetRir,
                }
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
      // Swap two blocks, whatever size they are. The old version had a
      // pair-shaped branch and a single-exercise branch and could express
      // nothing else, so a template mixing the two had no correct path through
      // it. One block swap covers a straight set, a pair and a triple.
      const runs = runIndexes(workout.exercises);
      const currentRun = runs[currentExerciseIndex];
      const targetRun = runs[targetIndex];
      if (currentRun === targetRun) return;

      const positionsOf = (run: number) =>
        runs.reduce<number[]>((acc, r, i) => (r === run ? [...acc, i] : acc), []);

      // Rebuild the list run by run, substituting one block for the other.
      // Blocks can differ in length, so everything after the earlier of the two
      // shifts — which is why order_index is reassigned wholesale below rather
      // than patched at the four positions that used to be involved.
      const runOrder = [...new Set(runs)];
      const reordered = runOrder.flatMap((run) => {
        const source =
          run === currentRun ? targetRun : run === targetRun ? currentRun : run;
        return positionsOf(source).map((i) => workout.exercises[i]);
      });

      // Groups travel with their exercises; normalise renumbers them so they
      // stay contiguous and ascending after the move.
      const exercises = normalise(reordered).map((exercise, index) => ({
        ...exercise,
        order_index: index,
      }));

      for (const exercise of exercises) {
        const previous = workout.exercises.find((e) => e.id === exercise.id);
        if (
          previous &&
          previous.order_index === exercise.order_index &&
          (previous.superset_group ?? null) === (exercise.superset_group ?? null)
        ) {
          continue;
        }

        const { error } = await supabase
          .from('workout_exercises')
          .update({
            order_index: exercise.order_index,
            superset_group: exercise.superset_group ?? null,
          })
          .eq('id', exercise.id);

        if (error) throw error;
      }

      setWorkout({ ...workout, exercises });

      // The block that was jumped to now occupies the slot the current one had.
      const newRuns = runIndexes(exercises);
      const landedAt = positionsOf(currentRun)[0];
      const blockPositions = newRuns.reduce<number[]>(
        (acc, r, i) => (r === newRuns[landedAt] ? [...acc, i] : acc),
        [],
      );

      // Resume at whichever exercise in the block has the least done, so a
      // half-finished block picks up where it was left rather than restarting.
      const leastDone = [...blockPositions].sort(
        (a, b) =>
          exercises[a].logs.filter((l) => l.completed).length -
          exercises[b].logs.filter((l) => l.completed).length,
      )[0];

      setCurrentExerciseIndex(blockPositions[0]);
      setActiveExerciseIndex(leastDone ?? blockPositions[0]);
      setExerciseTime(0);
      toast.success('Exercises swapped');
    } catch (error) {
      console.error('Error swapping exercises:', error);
      toast.error('Failed to swap exercises');
    }
  };

  const currentExercise = getCurrentExercise();
  // The positions making up the block being performed right now — one exercise
  // for a straight set, several for a superset.
  const currentBlock = (() => {
    if (!workout) return [];
    const runs = runIndexes(workout.exercises);
    const run = runs[currentExerciseIndex];
    return runs.reduce<number[]>((acc, r, i) => (r === run ? [...acc, i] : acc), []);
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!workout) {
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="sticky top-0 z-10 bg-surface-raised border-b shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-xl font-semibold text-content truncate">{workout.name}</h1>
              {pendingSync > 0 && (
                <span
                  className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-caution-soft px-2 py-0.5 text-xs font-medium text-caution"
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
                    className="p-1.5 text-content-subtle hover:text-accent hover:bg-accent-soft rounded-full transition-colors"
                    title="Undo last set"
                  >
                    <Undo2 className="h-5 w-5" />
                  </button>
                )}
                <button
                  onClick={() => setShowQuitDialog(true)}
                  className="p-1.5 text-content-subtle hover:text-critical hover:bg-critical-soft rounded-full"
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
            {/* Render the whole current block. Previously this was hardcoded to
                one exercise plus an optional partner, which is why a template
                could only ever be all pairs or all singles. */}
            {currentBlock.map((index) => (
              <CurrentExercise
                key={workout.exercises[index].id}
                exercise={workout.exercises[index]}
                onCompleteSet={handleCompleteSet}
                isSuperset={currentBlock.length > 1}
                isActive={currentBlock.length === 1 || activeExerciseIndex === index}
                stall={cleanStalls[workout.exercises[index].exercise.id]}
              />
            ))}
          </div>
        )}
      </div>

      <ExerciseList
        exercises={workout.exercises}
        currentExerciseIndex={currentExerciseIndex}
        onJumpToExercise={handleJumpToExercise}
      />

      {showQuitDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface-raised rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-content mb-4">
              End Workout?
            </h3>
            <p className="text-sm text-content-muted mb-6">
              Do you want to save your progress or delete this workout?
            </p>
            {undoState && (
              <div className="mb-4 p-3 bg-accent-soft border border-accent rounded-md">
                <button
                  onClick={() => {
                    handleUndoSet();
                    setShowQuitDialog(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-accent-content hover:bg-accent-soft rounded-md transition-colors"
                >
                  <Undo2 className="h-4 w-4" />
                  Undo Last Set
                </button>
                <p className="text-xs text-accent mt-2 text-center">
                  Accidentally recorded a set? Undo it before ending.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowQuitDialog(false)}
                className="px-4 py-2 text-sm font-medium text-content-muted hover:bg-surface border border-edge-strong rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={deleteWorkout}
                className="px-4 py-2 text-sm font-medium text-content-inverse bg-critical hover:bg-critical rounded-md"
              >
                Delete
              </button>
              <button
                onClick={endWorkout}
                className="px-4 py-2 text-sm font-medium text-content-inverse bg-accent hover:bg-accent-hover rounded-md"
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