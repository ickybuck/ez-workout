import React from 'react';
import { ExternalLink } from 'lucide-react';
import { ActiveWorkoutExercise } from '../../types/workout';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { runIndexes, isPairedWithNext, isInSuperset } from '../../lib/supersets';

interface ExerciseListProps {
  exercises: ActiveWorkoutExercise[];
  currentExerciseIndex: number;
  onJumpToExercise?: (index: number) => void;
}

const ExerciseList: React.FC<ExerciseListProps> = ({
  exercises,
  currentExerciseIndex,
  onJumpToExercise,
}) => {
  const { formatWeight } = useWeightUnit();

  // Pairing is data now, not an ordering convention. Every question below is
  // really "which block is this in", so it is answered once here rather than
  // by four separate index-parity guesses.
  const runs = runIndexes(exercises);
  const positionsInRun = (run: number) =>
    runs.reduce<number[]>((acc, r, i) => (r === run ? [...acc, i] : acc), []);

  const isCurrentOrNext = (index: number) =>
    runs[index] !== undefined && runs[index] === runs[currentExerciseIndex];

  const isFullyCompleted = (exercise: ActiveWorkoutExercise) => {
    return exercise.logs.every(log => log.completed);
  };

  const canSwapWith = (index: number) => {
    if (!onJumpToExercise) return false;
    if (isCurrentOrNext(index)) return false;

    // A block is available while any exercise in it still has work left.
    return positionsInRun(runs[index]).some((i) => !isFullyCompleted(exercises[i]));
  };

  const handleClick = (index: number) => {
    if (canSwapWith(index)) {
      onJumpToExercise?.(index);
    }
  };

  // A divider separates blocks, not exercises, so it goes wherever a new run
  // starts — which for a template of straight sets is every row, and for a
  // fully paired one is every other row, exactly as before.
  const shouldShowDivider = (index: number) => index !== 0 && runs[index] !== runs[index - 1];

  return (
    <div className="max-w-xl mx-auto px-4 py-4">
      <div className="bg-surface-raised rounded shadow-sm">
        {exercises.map((exercise, index) => {
          const completedSets = exercise.logs.filter(log => log.completed);
          // Net reps against target across the completed sets: misses count
          // down, reps past the target count up. Showing only the shortfall
          // meant a set carried three reps past its target read the same as one
          // that merely hit it, which is exactly the signal `extra_reps` was
          // added to surface.
          const netReps = exercise.logs
            .filter(log => log.completed)
            .reduce(
              (total, log) => total + (log.extra_reps ?? 0) - (log.failed_reps ?? 0),
              0,
            );
          const incompleteSets = exercise.logs.filter(log => !log.completed);
          const nextSet = incompleteSets[0];

          const fullyCompleted = isFullyCompleted(exercise);
          const swappable = canSwapWith(index);

          // The bracket is drawn between two exercises that are actually paired,
          // rather than at every even index.
          const showSupersetBridge = isPairedWithNext(exercises, index);
          const showDivider = shouldShowDivider(index);

          return (
            <div
              key={exercise.id}
              onClick={() => handleClick(index)}
              className={`relative px-3 py-2 ${
                showDivider ? 'border-t' : ''
              } ${
                isCurrentOrNext(index)
                  ? 'bg-accent-soft border-l-2 border-accent'
                  : ''
              } ${
                fullyCompleted
                  ? 'opacity-60'
                  : ''
              } ${
                swappable
                  ? 'cursor-pointer hover:bg-surface transition-colors'
                  : isCurrentOrNext(index) ? '' : 'cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate">
                    <h3 className="font-medium text-content text-sm truncate">
                      {exercise.exercise.name}
                    </h3>
                    <span className="text-base flex-shrink-0" title={exercise.exercise.equipment_type.name}>
                      {exercise.exercise.equipment_type.emoji}
                    </span>
                    {!isInSuperset(exercises, index) && swappable && (
                      <ExternalLink className="h-4.5 w-4.5 text-accent flex-shrink-0" />
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-medium text-content">
                    {completedSets.length}/{exercise.logs.length}
                    {netReps !== 0 && (
                      <span
                        className={`ml-1 ${netReps > 0 ? 'text-positive' : 'text-caution'}`}
                        title={
                          netReps > 0
                            ? `${netReps} reps past target across all sets`
                            : `${-netReps} reps short of target across all sets`
                        }
                      >
                        | {netReps > 0 ? `+${netReps}` : netReps}
                      </span>
                    )}
                  </div>
                  {nextSet && (
                    <div className="text-xs text-content-muted">
                      {nextSet.reps} × {formatWeight(nextSet.weight)}
                    </div>
                  )}
                </div>
              </div>

              {showSupersetBridge && (
                <div className="absolute left-0 right-0 -bottom-3 flex justify-center pointer-events-none z-10">
                  <div className="relative">
                    <div
                      className={`
                        px-3 py-0.5 bg-accent
                        text-content-inverse rounded-full shadow-md
                        pointer-events-auto
                        ${swappable ? 'cursor-pointer hover:bg-accent-hover transition-all' : 'opacity-75'}
                      `}
                    >
                      <span className="text-xs font-semibold">
                        Superset
                      </span>
                    </div>
                    {swappable && (
                      <ExternalLink className="h-5 w-5 text-accent pointer-events-auto absolute left-full ml-2 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExerciseList;