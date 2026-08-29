import React, { useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { ActiveWorkoutExercise } from '../../types/workout';
import SetProgress from './SetProgress';
import type { SetOutcomeInput } from '../../lib/stopReason';
import { describeCleanStall, type CleanStall } from '../../lib/cleanStall';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { formatVolume } from '../../lib/weight';

interface CurrentExerciseProps {
  exercise: ActiveWorkoutExercise;
  onCompleteSet: (logId: string, outcome?: SetOutcomeInput) => void;
  isSuperset?: boolean;
  isActive?: boolean;
  /** Present when this load has been completed cleanly for several sessions. */
  stall?: CleanStall;
}

const CurrentExercise: React.FC<CurrentExerciseProps> = ({ 
  exercise, 
  onCompleteSet,
  isSuperset,
  isActive = true,
  stall,
}) => {
  const [showInfo, setShowInfo] = useState(false);
  const { unit } = useWeightUnit();

  return (
    <div className={`bg-white rounded shadow-sm p-4 ${!isActive ? 'opacity-50' : ''}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-medium text-gray-900">
            {exercise.exercise.name}
          </h2>
          <span className="text-lg" title={exercise.exercise.equipment_type.name}>
            {exercise.exercise.equipment_type.emoji}
          </span>
          {isSuperset && (
            <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
              Superset
            </span>
          )}
          {exercise.exercise.description && (
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              aria-label={showInfo ? "Hide exercise information" : "Show exercise information"}
            >
              {showInfo ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        {showInfo && exercise.exercise.description && (
          <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
            {exercise.exercise.description}
          </div>
        )}
        {/* Only while this exercise is the one being performed — a nudge on a
            greyed-out card is noise, and this can be true of several exercises
            in the same session. */}
        {stall && isActive && (
          <div className="mt-2 flex items-start gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2">
            <TrendingUp className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-800">
              {/* Whole units, not formatWeight. The stall's weight is the
                  heaviest set of the run, and converting a stored kilogram
                  value back to pounds produced "275.14 lb" directly above a
                  set line reading "275 lb". A headline number carrying more
                  precision than the thing it describes reads as a different
                  weight entirely. */}
              {describeCleanStall(stall, (kg) => formatVolume(kg, unit))}
            </p>
          </div>
        )}

        <SetProgress
          logs={exercise.logs}
          onComplete={onCompleteSet}
          disabled={!isActive}
          exerciseId={exercise.exercise.id}
          isPlateLoaded={exercise.exercise.is_plate_loaded}
          exerciseName={exercise.exercise.name}
        />
      </div>
    </div>
  );
};

export default CurrentExercise;