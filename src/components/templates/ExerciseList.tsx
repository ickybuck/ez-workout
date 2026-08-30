import React from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Scale, Link2, Unlink } from 'lucide-react';
import { WorkoutTemplate } from '../../types/template';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { isPairedWithNext, isInSuperset, linkWithNext, splitAfter } from '../../lib/supersets';

interface ExerciseListProps {
  template: WorkoutTemplate;
  onTemplateChange: (template: WorkoutTemplate) => void;
  onAddClick: () => void;
  onRemoveExercise: (id: string) => void;
  onMoveExercise: (index: number, direction: 'up' | 'down') => void;
  onExerciseValuesChange: (exerciseId: string, values: { sets?: number; reps?: number; weight?: number }) => void;
}

const ExerciseList: React.FC<ExerciseListProps> = ({
  template,
  onTemplateChange,
  onAddClick,
  onRemoveExercise,
  onMoveExercise,
  onExerciseValuesChange,
}) => {
  const { unit, convertWeight, parseWeight } = useWeightUnit();

  // Filter out exercises with missing data
  const validExercises = template.exercises.filter(
    exercise => exercise?.exercise && exercise.exercise?.equipment_type
  );

  // Pairing is edited between rows rather than on them, because a superset is
  // a relationship, not a property of one exercise. The control sits on the
  // join it affects, so there is never a question of which of the two a toggle
  // belongs to.
  const toggleJoin = (index: number) => {
    const next = isPairedWithNext(validExercises, index)
      ? splitAfter(validExercises, index)
      : linkWithNext(validExercises, index);

    onTemplateChange({ ...template, exercises: next });
  };

  const handleWeightChange = (exerciseId: string, value: string) => {
    const kgWeight = parseWeight(value);
    onExerciseValuesChange(exerciseId, { weight: kgWeight });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium text-content">Exercises</h3>
          <span className="px-2 py-0.5 text-sm bg-surface-sunken text-content-muted rounded-full">
            {validExercises.length}
          </span>
        </div>
        <button
          onClick={onAddClick}
          className="flex items-center px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-content-inverse bg-accent hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Exercise
        </button>
      </div>

      <p className="text-xs text-content-subtle -mt-2">
        Use the link between two exercises to superset them — they’re performed
        together with one rest after the pair. Unlinked exercises are straight
        sets with their own rest.
      </p>

      <div className="space-y-2">
        {validExercises.map((exercise, index) => (
          <React.Fragment key={exercise.id}>
          <div
            className={`flex items-start gap-4 p-3 rounded-lg ${
              isInSuperset(validExercises, index)
                ? 'bg-accent-soft border border-accent'
                : 'bg-surface'
            }`}
          >
            {/* Move Buttons */}
            <div className="flex flex-col gap-1 mt-1">
              <button
                onClick={() => onMoveExercise(index, 'up')}
                disabled={index === 0}
                className="p-2 text-content-subtle hover:text-content-muted disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => onMoveExercise(index, 'down')}
                disabled={index === validExercises.length - 1}
                className="p-2 text-content-subtle hover:text-content-muted disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            {/* Exercise Info */}
            <div className="flex-1 min-w-0">
              {/* First Line: Name and Equipment */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-content truncate">
                    {exercise.exercise.name}
                  </div>
                  <span className="text-xl" title={exercise.exercise.equipment_type.name}>
                    {exercise.exercise.equipment_type.emoji}
                  </span>
                  {exercise.exercise.is_plate_loaded && (
                    <Scale className="h-4 w-4 text-content-subtle" title="Plate loaded exercise" />
                  )}
                </div>
                <button
                  onClick={() => onRemoveExercise(exercise.id)}
                  className="p-2.5 text-content-subtle hover:text-critical"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Second Line: Exercise Parameters */}
              <div className="flex items-baseline gap-2 text-sm">
                <div className="flex items-baseline gap-1">
                  <span className="text-content-subtle uppercase text-xs">s</span>
                  <input
                    type="number"
                    min="1"
                    value={exercise.default_sets}
                    onChange={e => {
                      const sets = parseInt(e.target.value);
                      onExerciseValuesChange(exercise.exercise.id, { sets });
                    }}
                    className="w-8 h-7 rounded-md border-edge-strong shadow-sm focus:border-accent focus:ring-accent text-sm"
                  />
                </div>
                <span className="text-content-subtle">×</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-content-subtle uppercase text-xs">r</span>
                  <input
                    type="number"
                    min="1"
                    value={exercise.default_reps}
                    onChange={e => {
                      const reps = parseInt(e.target.value);
                      onExerciseValuesChange(exercise.exercise.id, { reps });
                    }}
                    className="w-8 h-7 rounded-md border-edge-strong shadow-sm focus:border-accent focus:ring-accent text-sm"
                  />
                </div>
                <span className="text-content-subtle">@</span>
                <div className="flex items-baseline gap-1">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={convertWeight(exercise.default_weight || 0)}
                    onChange={e => handleWeightChange(exercise.exercise.id, e.target.value)}
                    className="w-12 h-7 rounded-md border-edge-strong shadow-sm focus:border-accent focus:ring-accent text-sm"
                  />
                  <span className="text-content-subtle text-xs">{unit}</span>
                </div>
              </div>
            </div>
          </div>

          {index < validExercises.length - 1 && (
            <div className="flex justify-center py-0.5">
              <button
                type="button"
                onClick={() => toggleJoin(index)}
                title={
                  isPairedWithNext(validExercises, index)
                    ? 'Split — perform these separately, with a rest between'
                    : 'Superset — perform these together, one rest after the pair'
                }
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  isPairedWithNext(validExercises, index)
                    ? 'bg-accent text-content-inverse hover:bg-accent-hover'
                    : 'bg-surface-raised border border-dashed border-edge-strong text-content-subtle hover:border-accent hover:text-accent'
                }`}
              >
                {isPairedWithNext(validExercises, index) ? (
                  <>
                    <Link2 className="h-3.5 w-3.5" />
                    Superset
                  </>
                ) : (
                  <>
                    <Unlink className="h-3.5 w-3.5" />
                    Link
                  </>
                )}
              </button>
            </div>
          )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default ExerciseList;