import React, { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Exercise } from '../../types/exercise';
import { useWeightUnit } from '../../hooks/useWeightUnit';

interface ExerciseSelectorProps {
  exercises: Exercise[];
  addedExerciseIds: string[];
  onSelect: (exercises: Exercise[]) => void;
  onClose: () => void;
  isAdding?: boolean;
}

const ExerciseSelector: React.FC<ExerciseSelectorProps> = ({
  exercises,
  addedExerciseIds,
  onSelect,
  onClose,
  isAdding = false,
}) => {
  const { formatWeight } = useWeightUnit();
  const [selectedExercises, setSelectedExercises] = useState<Set<string>>(
    new Set(addedExerciseIds)
  );

  // Filter out exercises with missing data
  const validExercises = exercises.filter(exercise => {
    return exercise && exercise.id && exercise.name;
  });

  const handleToggleExercise = (exerciseId: string) => {
    setSelectedExercises(prev => {
      const next = new Set(prev);
      if (next.has(exerciseId)) {
        next.delete(exerciseId);
      } else {
        next.add(exerciseId);
      }
      return next;
    });
  };

  const handleSave = () => {
    const selectedExercisesList = validExercises.filter(
      exercise => selectedExercises.has(exercise.id)
    );
    onSelect(selectedExercisesList);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-surface-raised rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-medium">Add Exercises</h3>
            <span className="text-sm text-content-subtle">
              {selectedExercises.size} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={selectedExercises.size === 0 || isAdding}
              className="flex items-center px-3 py-1.5 text-sm font-medium text-content-inverse bg-accent rounded-md hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4 mr-1" />
              {isAdding ? 'Adding...' : 'Add Selected'}
            </button>
            <button
              onClick={onClose}
              disabled={isAdding}
              className="text-content-subtle hover:text-content-subtle disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="space-y-2">
            {validExercises.map(exercise => {
              const isSelected = selectedExercises.has(exercise.id);

              return (
                <div
                  key={exercise.id}
                  onClick={() => !isAdding && handleToggleExercise(exercise.id)}
                  className={`p-3 rounded-lg transition-colors duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-accent-soft border border-accent'
                      : 'hover:bg-surface border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5">
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-accent border-accent text-content-inverse'
                            : 'border-edge-strong'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-content">{exercise.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {exercise.equipment_type && (
                          <span className="text-xs px-2 py-0.5 bg-surface-sunken text-content-muted rounded-full">
                            {exercise.equipment_type.name}
                          </span>
                        )}
                        {exercise.body_part && (
                          <span className="text-xs px-2 py-0.5 bg-surface-sunken text-content-muted rounded-full">
                            {exercise.body_part.name}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-content-subtle mt-1">
                        {exercise.defaults?.[0]
                          ? `${exercise.defaults[0].sets} sets × ${exercise.defaults[0].reps} reps @ ${formatWeight(exercise.defaults[0].weight)}`
                          : `${exercise.is_compound ? '4' : '3'} sets × ${exercise.is_compound ? '8' : '12'} reps @ 0 kg`}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExerciseSelector;