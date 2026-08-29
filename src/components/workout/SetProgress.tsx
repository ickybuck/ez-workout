import React, { useState } from 'react';
import { Check, AlertTriangle, X, Plus, Minus, TrendingUp } from 'lucide-react';
import { ExerciseLog } from '../../types/workout';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { useActiveWorkout } from '../../hooks/useActiveWorkout';
import PlateCalculator from '../exercises/PlateCalculator';
import StopReasonChips from './StopReasonChips';
import type { SetOutcomeInput, StopReason } from '../../lib/stopReason';

interface SetProgressProps {
  logs: ExerciseLog[];
  onComplete: (logId: string, outcome?: SetOutcomeInput) => void;
  disabled?: boolean;
  exerciseId: string;
  isPlateLoaded?: boolean;
  exerciseName?: string;
}

const SetProgress: React.FC<SetProgressProps> = ({
  logs,
  onComplete,
  disabled = false,
  exerciseId,
  isPlateLoaded = false,
  exerciseName,
}) => {
  const { formatWeight } = useWeightUnit();
  const [showPartialReps, setShowPartialReps] = useState(false);
  const [showExtraReps, setShowExtraReps] = useState(false);
  // Set once a rep count is chosen, cleared once a reason is given or skipped.
  // Holding it here is what lets the reason chips appear inside the panel that
  // is already open, rather than arriving as a second interruption after the
  // set has been logged.
  const [pendingShortfall, setPendingShortfall] = useState<number | null>(null);
  const [adjustingWeight, setAdjustingWeight] = useState(false);
  const [showPlateCalculator, setShowPlateCalculator] = useState(false);
  const [weightIncrement, setWeightIncrement] = useState(2.3); // in kg
  const [availablePlatesKg, setAvailablePlatesKg] = useState<number[]>([25, 20, 15, 10, 5, 2.5, 1.25]);
  const [availablePlatesLb, setAvailablePlatesLb] = useState<number[]>([45, 35, 25, 10, 5, 2.5]);
  const { workout, setWorkout } = useActiveWorkout();
  const completedSets = logs.filter(log => log.completed).length;
  const currentSet = logs.find(log => !log.completed);
  const progress = (completedSets / logs.length) * 100;
  const isComplete = completedSets === logs.length;

  // Load weight increment and plate settings when component mounts
  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load exercise defaults
        const { data: exerciseData, error: exerciseError } = await supabase
          .from('exercise_defaults')
          .select('weight_increment')
          .eq('exercise_id', exerciseId)
          .maybeSingle();

        if (exerciseError) throw exerciseError;
        if (exerciseData?.weight_increment) {
          setWeightIncrement(exerciseData.weight_increment);
        }

        // Load user plate settings
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: settingsData, error: settingsError } = await supabase
            .from('user_settings')
            .select('available_plates_kg, available_plates_lb')
            .eq('user_id', user.id)
            .maybeSingle();

          if (settingsError) throw settingsError;
          if (settingsData) {
            if (settingsData.available_plates_kg) {
              setAvailablePlatesKg(settingsData.available_plates_kg);
            }
            if (settingsData.available_plates_lb) {
              setAvailablePlatesLb(settingsData.available_plates_lb);
            }
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettings();
  }, [exerciseId]);

  const handlePartialSet = (completedReps: number) => {
    if (!currentSet || disabled) return;
    setPendingShortfall(completedReps);
  };

  const commitShortfall = (stopReason: StopReason | null) => {
    if (!currentSet || pendingShortfall === null) return;
    onComplete(currentSet.id, { completedReps: pendingShortfall, stopReason });
    setPendingShortfall(null);
    setShowPartialReps(false);
  };

  const handleExtraSet = (extraReps: number) => {
    if (!currentSet || disabled) return;
    // No reason chips here. Nothing went wrong, and the overage is itself the
    // whole signal — counted rather than judged, which is what makes it better
    // evidence than an estimate of what was left in reserve.
    onComplete(currentSet.id, { extraReps });
    setShowExtraReps(false);
  };

  const adjustWeight = async (increment: boolean, newWeight?: number) => {
    if (!currentSet || adjustingWeight || !workout) return;

    try {
      setAdjustingWeight(true);

      const weightToSet = newWeight ?? (increment 
        ? currentSet.weight + weightIncrement 
        : currentSet.weight - weightIncrement);

      if (weightToSet < 0) {
        toast.error('Weight cannot be negative');
        return;
      }

      // Update all remaining sets in this workout
      const { error: updateError } = await supabase
        .from('exercise_logs')
        .update({ weight: weightToSet })
        .eq('workout_exercise_id', logs[0].workout_exercise_id)
        .gte('set_number', currentSet.set_number);

      if (updateError) throw updateError;

      // Update exercise defaults
      const { error: defaultUpdateError } = await supabase
        .from('exercise_defaults')
        .update({ 
          weight: weightToSet,
          updated_at: new Date().toISOString()
        })
        .eq('exercise_id', exerciseId);

      if (defaultUpdateError) throw defaultUpdateError;

      // Update all template exercises that use this exercise
      const { error: templateError } = await supabase
        .from('template_exercises')
        .update({ 
          default_weight: weightToSet,
          updated_at: new Date().toISOString()
        })
        .eq('exercise_id', exerciseId);

      if (templateError) throw templateError;

      // Update local state
      const updatedWorkout = {
        ...workout,
        exercises: workout.exercises.map(ex => {
          if (ex.id === logs[0].workout_exercise_id) {
            return {
              ...ex,
              logs: ex.logs.map(log => {
                if (log.set_number >= currentSet.set_number) {
                  return { ...log, weight: weightToSet };
                }
                return log;
              }),
            };
          }
          return ex;
        }),
      };
      setWorkout(updatedWorkout);

      toast.success(`Weight ${increment ? 'increased' : 'decreased'} to ${formatWeight(weightToSet)}`);
    } catch (error) {
      console.error('Error adjusting weight:', error);
      toast.error('Failed to adjust weight');
    } finally {
      setAdjustingWeight(false);
    }
  };

  const handleWeightClick = () => {
    if (isPlateLoaded && currentSet && !disabled) {
      setShowPlateCalculator(true);
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">
            {isComplete ? (
              <span className="text-emerald-600">Complete</span>
            ) : (
              `Set ${completedSets + 1} of ${logs.length}`
            )}
          </span>
          {currentSet && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => adjustWeight(false)}
                disabled={disabled || adjustingWeight}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full disabled:opacity-50"
                title="Decrease weight"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-gray-500">
                {currentSet.reps} ×{' '}
              </span>
              <button
                onClick={handleWeightClick}
                className={`px-2 py-1 rounded ${
                  isPlateLoaded
                    ? 'bg-gray-100 hover:bg-indigo-100 text-gray-900 hover:text-indigo-600 cursor-pointer transition-colors duration-150'
                    : 'text-gray-500'
                }`}
                disabled={!isPlateLoaded || disabled}
                title={isPlateLoaded ? "Click to calculate plates" : undefined}
              >
                {formatWeight(currentSet.weight)}
              </button>
              <button
                onClick={() => adjustWeight(true)}
                disabled={disabled || adjustingWeight}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full disabled:opacity-50"
                title="Increase weight"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${
              isComplete ? 'bg-emerald-500' : 'bg-indigo-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {currentSet && !showPartialReps && !showExtraReps && !disabled && (
        <div className="flex gap-2">
          <button
            onClick={() => onComplete(currentSet.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors whitespace-nowrap"
          >
            <Check className="h-4 w-4" />
            <span>Complete</span>
          </button>
          <button
            onClick={() => setShowExtraReps(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700 transition-colors whitespace-nowrap"
            title="Did more reps than the target"
          >
            <TrendingUp className="h-4 w-4" />
            <span>More</span>
          </button>
          <button
            onClick={() => setShowPartialReps(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors whitespace-nowrap"
          >
            <AlertTriangle className="h-4 w-4" />
            <span>Partial</span>
          </button>
        </div>
      )}

      {currentSet && showExtraReps && !disabled && (
        <div className="bg-emerald-50 border border-emerald-200 rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-emerald-800">
              How many past {currentSet.reps}?
            </h4>
            <button
              onClick={() => setShowExtraReps(false)}
              className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 rounded-full"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: 10 }, (_, i) => (
              <button
                key={i}
                onClick={() => handleExtraSet(i + 1)}
                className="py-2 px-2 bg-white border border-emerald-200 rounded text-sm font-medium text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
              >
                +{i + 1}
              </button>
            ))}
          </div>
          <p className="text-xs text-emerald-700 mt-2">
            Beating the target is how the weight gets moved up — it counts.
          </p>
        </div>
      )}

      {currentSet && showPartialReps && !disabled && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-yellow-800">
              {pendingShortfall === null ? 'Select completed reps' : `${pendingShortfall} of ${currentSet.reps} done`}
            </h4>
            <button
              onClick={() => {
                setShowPartialReps(false);
                setPendingShortfall(null);
              }}
              className="p-1 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-100 rounded-full"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {pendingShortfall === null ? (
            <>
              <div className="grid grid-cols-5 gap-1.5">
                {/* Add 0 reps option for failed sets */}
                <button
                  onClick={() => handlePartialSet(0)}
                  className="py-1.5 px-2 bg-red-100 border border-red-200 rounded text-sm text-red-800 hover:bg-red-200 hover:border-red-300 transition-colors font-medium"
                >
                  0
                </button>
                {Array.from({ length: currentSet.reps - 1 }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => handlePartialSet(i + 1)}
                    className="py-1.5 px-2 bg-white border border-yellow-200 rounded text-sm text-yellow-800 hover:bg-yellow-100 hover:border-yellow-300 transition-colors"
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <p className="text-xs text-yellow-700 mt-2">
                Select 0 if you couldn't complete any reps (failed set)
              </p>
            </>
          ) : (
            <StopReasonChips
              variant={pendingShortfall === 0 ? 'skipped' : 'partial'}
              onChoose={(reason) => commitShortfall(reason)}
              onSkip={() => commitShortfall(null)}
            />
          )}
        </div>
      )}

      {/* Plate Calculator */}
      {showPlateCalculator && currentSet && (
        <PlateCalculator
          weight={currentSet.weight}
          onWeightChange={(weight) => adjustWeight(true, weight)}
          weightIncrement={weightIncrement}
          isOpen={showPlateCalculator}
          onClose={() => setShowPlateCalculator(false)}
          exerciseId={exerciseId}
          exerciseName={exerciseName}
          availablePlatesKg={availablePlatesKg}
          availablePlatesLb={availablePlatesLb}
        />
      )}
    </div>
  );
};

export default SetProgress;