import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Exercise } from '../types/exercise';
import { useExerciseData } from '../hooks/useExerciseData';
import ExerciseFormV2 from '../components/exercises/ExerciseFormV2';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { defaultIncrementKg } from '../lib/weight';
import { useAdminStatus } from '../hooks/useAdminStatus';
import { changedSharedFields, sharedChangeWarning } from '../lib/exerciseSharing';

const ExerciseEdit: React.FC = () => {
  const { id } = useParams();
  const { unit } = useWeightUnit();
  const navigate = useNavigate();
  const { isAdmin } = useAdminStatus();
  const {
    exercises,
    equipmentTypes,
    bodyParts,
    muscleGroups,
    loading,
    updateExercise,
  } = useExerciseData();

  const [editForm, setEditForm] = useState<Partial<Exercise>>({});
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<Array<{ id: string; is_primary: boolean }>>([]);

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!loading && id) {
      const exercise = exercises.find(e => e.id === id);
      if (exercise) {
        setEditForm({
          name: exercise.name,
          description: exercise.description,
          equipment_type: exercise.equipment_type,
          body_part: exercise.body_part,
          is_compound: exercise.is_compound,
          is_plate_loaded: exercise.is_plate_loaded,
          defaults: {
            sets: exercise.defaults?.sets || 3,
            reps: exercise.defaults?.reps || 10,
            weight: exercise.defaults?.weight || 0,
            weight_increment: exercise.defaults?.weight_increment || defaultIncrementKg(unit),
            rep_increment: exercise.defaults?.rep_increment || 1,
            bar_weight: exercise.defaults?.bar_weight,
            extended_rest: exercise.defaults?.extended_rest ?? false,
          },
        });
        setSelectedMuscleGroups(
          exercise.muscle_groups.map(mg => ({
            id: mg.muscle_group.id,
            is_primary: mg.is_primary,
          }))
        );
      } else {
        navigate('/dashboard/exercises');
      }
    }
  }, [id, loading, exercises]);

  const toggleMuscleGroup = (muscleGroupId: string, isPrimary: boolean) => {
    setSelectedMuscleGroups(prev => {
      const existing = prev.find(mg => mg.id === muscleGroupId);
      if (existing) {
        if (existing.is_primary === isPrimary) {
          return prev.filter(mg => mg.id !== muscleGroupId);
        }
        return prev.map(mg =>
          mg.id === muscleGroupId ? { ...mg, is_primary: isPrimary } : mg
        );
      }
      return [...prev, { id: muscleGroupId, is_primary: isPrimary }];
    });
  };

  const handleSave = async () => {
    if (!id) return;

    // The library is shared by every account. Changing what an exercise is
    // changes it for everyone, so it is admin-only and confirmed first
    // (EZ-51). Your own targets are saved either way.
    const original = exercises.find(e => e.id === id);
    const changed = original
      ? changedSharedFields(
          {
            name: original.name,
            description: original.description,
            equipmentTypeId: original.equipment_type?.id,
            bodyPartId: original.body_part?.id,
            isCompound: original.is_compound,
            isPlateLoaded: original.is_plate_loaded,
            muscleGroups: original.muscle_groups.map(mg => ({ id: mg.muscle_group.id, is_primary: mg.is_primary })),
          },
          {
            name: editForm.name,
            description: editForm.description,
            equipmentTypeId: editForm.equipment_type?.id,
            bodyPartId: editForm.body_part?.id,
            isCompound: editForm.is_compound,
            isPlateLoaded: editForm.is_plate_loaded,
            muscleGroups: selectedMuscleGroups,
          },
        )
      : [];

    if (changed.length > 0 && !isAdmin) {
      toast.error(`Only an admin can change the ${changed.join(', ')} of a shared exercise. Your sets, reps and weight can be changed freely.`);
      return;
    }

    if (changed.length > 0 && !confirm(sharedChangeWarning(original?.name ?? editForm.name ?? 'this exercise', changed))) {
      return;
    }

    const success = await updateExercise(id, {
      ...editForm,
      // Muscle groups are only rewritten when they changed: the rewrite is a
      // delete then insert on a shared, admin-only table.
      muscle_groups: changed.includes('muscle groups')
        ? selectedMuscleGroups.map(mg => ({
            muscle_group: muscleGroups.find(m => m.id === mg.id)!,
            is_primary: mg.is_primary,
          }))
        : undefined,
    });

    if (success) {
      navigate('/dashboard/exercises');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="py-5">
      <div className="bg-surface-raised rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard/exercises')}
              className="text-content-muted hover:text-content"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-2xl font-bold text-content">Edit Exercise</h2>
          </div>
        </div>

        <div className="mb-4 flex gap-2 rounded-md border border-edge bg-surface p-3 text-sm text-content-muted">
          <Users className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            {isAdmin
              ? 'Name, description, equipment, body part, muscle groups, compound and plate-loaded are shared: changing them changes this exercise for everyone. Sets, reps, weight and the rest are yours alone.'
              : 'Name, description, equipment, body part, muscle groups, compound and plate-loaded are shared with everyone and only an admin can change them. Sets, reps, weight and the rest are yours to change.'}
          </p>
        </div>

        <ExerciseFormV2
          editForm={editForm}
          setEditForm={setEditForm}
          selectedMuscleGroups={selectedMuscleGroups}
          toggleMuscleGroup={toggleMuscleGroup}
          equipmentTypes={equipmentTypes}
          bodyParts={bodyParts}
          muscleGroups={muscleGroups}
          onCancel={() => navigate('/dashboard/exercises')}
          onSave={handleSave}
          isEditing={true}
          exerciseId={id}
        />
      </div>
    </div>
  );
};

export default ExerciseEdit;