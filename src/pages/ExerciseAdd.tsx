import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { Exercise } from '../types/exercise';
import { useAuth } from '../contexts/AuthContext';
import { useExerciseData } from '../hooks/useExerciseData';
import ExerciseFormV2 from '../components/exercises/ExerciseFormV2';

const ExerciseAdd: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    equipmentTypes,
    bodyParts,
    muscleGroups,
    loading,
    loadExerciseData,
  } = useExerciseData();

  const [editForm, setEditForm] = useState<Partial<Exercise>>({
    // Carried from the library's search box, so someone who searched, scrolled
    // the results and still could not find it does not retype the name.
    name: searchParams.get('name') ?? '',
    description: '',
    equipment_type: equipmentTypes[0],
    body_part: bodyParts[0],
    is_compound: false,
    is_plate_loaded: false,
    defaults: {
      sets: 3,
      reps: 10,
      weight: 0,
      weight_increment: 2.3, // Changed from 2.5 to 2.3
    },
  });
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<Array<{ id: string; is_primary: boolean }>>([]);

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
    if (!editForm.name || !user) {
      toast.error('Exercise name is required');
      return;
    }

    try {
      const { data: newExercise, error: exerciseError } = await supabase
        .from('exercises')
        .insert({
          name: editForm.name,
          description: editForm.description,
          equipment_type_id: editForm.equipment_type?.id,
          body_part_id: editForm.body_part?.id,
          is_compound: editForm.is_compound,
          is_plate_loaded: editForm.is_plate_loaded,
        })
        .select()
        .single();

      if (exerciseError) {
        if (exerciseError.code === '23505') {
          toast.error(`"${editForm.name}" already exists in the library.`);
          return;
        }
        throw exerciseError;
      }

      const { error: defaultsError } = await supabase
        .from('exercise_defaults')
        .insert({
          exercise_id: newExercise.id,
          user_id: user.id,
          sets: editForm.defaults?.sets || 3,
          reps: editForm.defaults?.reps || 10,
          weight: editForm.defaults?.weight || 0,
          weight_increment: editForm.defaults?.weight_increment || 2.3, // Changed from 2.5 to 2.3
        });

      if (defaultsError) throw defaultsError;

      if (selectedMuscleGroups.length > 0) {
        const { error: muscleGroupError } = await supabase
          .from('exercise_muscle_groups')
          .insert(
            selectedMuscleGroups.map(mg => ({
              exercise_id: newExercise.id,
              muscle_group_id: mg.id,
              is_primary: mg.is_primary,
            }))
          );

        if (muscleGroupError) throw muscleGroupError;
      }

      toast.success('Exercise created successfully');
      await loadExerciseData();
      navigate('/dashboard/exercises');
    } catch (error) {
      console.error('Error saving exercise:', error);
      toast.error('Failed to save exercise');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-2 py-2">
      <div className="bg-white rounded-lg shadow-md p-3">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard/exercises')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-2xl font-bold text-gray-900">New Exercise</h2>
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
          isEditing={false}
        />
      </div>
    </div>
  );
};

export default ExerciseAdd;