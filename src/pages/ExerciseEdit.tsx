import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Exercise } from '../types/exercise';
import { useExerciseData } from '../hooks/useExerciseData';
import ExerciseFormV2 from '../components/exercises/ExerciseFormV2';

const ExerciseEdit: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
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
            weight_increment: exercise.defaults?.weight_increment || 2.3,
            rep_increment: exercise.defaults?.rep_increment || 1,
            bar_weight: exercise.defaults?.bar_weight,
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

    const success = await updateExercise(id, {
      ...editForm,
      muscle_groups: selectedMuscleGroups.map(mg => ({
        muscle_group: muscleGroups.find(m => m.id === mg.id)!,
        is_primary: mg.is_primary,
      })),
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