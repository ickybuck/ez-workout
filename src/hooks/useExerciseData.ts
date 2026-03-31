import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { Exercise, EquipmentType, BodyPart, MuscleGroup } from '../types/exercise';
import { useAuth } from '../contexts/AuthContext';

export const useExerciseData = () => {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([]);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const loadExerciseData = async () => {
    if (!user) return;

    try {
      const [exercisesData, equipmentData, bodyPartsData, muscleGroupsData] = await Promise.all([
        supabase
          .from('exercises')
          .select(`
            id,
            name,
            description,
            equipment_type:equipment_type_id(*),
            body_part:body_part_id(*),
            is_compound,
            is_plate_loaded,
            muscle_groups:exercise_muscle_groups(
              muscle_group:muscle_group_id(*),
              is_primary
            ),
            defaults:exercise_defaults!exercise_id(
              id,
              sets,
              reps,
              weight,
              weight_increment,
              rep_increment,
              bar_weight
            )
          `)
          .eq('defaults.user_id', user.id)
          .order('name'),
        supabase.from('equipment_types').select('*').order('name'),
        supabase.from('body_parts').select('*').order('name'),
        supabase.from('muscle_groups').select('*').order('name')
      ]);

      if (exercisesData.error) throw exercisesData.error;
      if (equipmentData.error) throw equipmentData.error;
      if (bodyPartsData.error) throw bodyPartsData.error;
      if (muscleGroupsData.error) throw muscleGroupsData.error;

      // Process exercises to handle the defaults array
      const processedExercises = exercisesData.data.map(exercise => ({
        ...exercise,
        defaults: exercise.defaults?.[0] || null
      }));

      setExercises(processedExercises);
      setEquipmentTypes(equipmentData.data);
      setBodyParts(bodyPartsData.data);
      setMuscleGroups(muscleGroupsData.data);
    } catch (error) {
      console.error('Error loading exercise data:', error);
      toast.error('Failed to load exercise data');
    } finally {
      setLoading(false);
    }
  };

  const updateExercise = async (exerciseId: string, updates: Partial<Exercise>) => {
    if (!user) return false;

    try {
      // Step 1: Update the exercise basic info
      const { error: exerciseError } = await supabase
        .from('exercises')
        .update({
          name: updates.name,
          description: updates.description,
          equipment_type_id: updates.equipment_type?.id,
          body_part_id: updates.body_part?.id,
          is_compound: updates.is_compound,
          is_plate_loaded: updates.is_plate_loaded,
          updated_at: new Date().toISOString(),
        })
        .eq('id', exerciseId);

      if (exerciseError) throw exerciseError;

      // Step 2: Update exercise defaults and template exercises in parallel
      if (updates.defaults) {
        const defaultBarWeight = updates.is_plate_loaded ? 20 : 0; // Set default bar weight based on plate loaded status

        const [defaultsResult, templateResult] = await Promise.all([
          // Update exercise defaults
          supabase
            .from('exercise_defaults')
            .upsert({
              exercise_id: exerciseId,
              user_id: user.id,
              sets: updates.defaults.sets,
              reps: updates.defaults.reps,
              weight: updates.defaults.weight,
              weight_increment: updates.defaults.weight_increment,
              rep_increment: updates.defaults.rep_increment,
              bar_weight: updates.defaults.bar_weight ?? defaultBarWeight,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'exercise_id,user_id',
            }),
          
          // Update all template exercises that use this exercise
          supabase
            .from('template_exercises')
            .update({
              default_sets: updates.defaults.sets,
              default_reps: updates.defaults.reps,
              default_weight: updates.defaults.weight,
              updated_at: new Date().toISOString(),
            })
            .eq('exercise_id', exerciseId)
        ]);

        if (defaultsResult.error) throw defaultsResult.error;
        if (templateResult.error) throw templateResult.error;
      }

      // Step 3: Update muscle groups if provided
      if (updates.muscle_groups) {
        const { error: deleteError } = await supabase
          .from('exercise_muscle_groups')
          .delete()
          .eq('exercise_id', exerciseId);

        if (deleteError) throw deleteError;

        if (updates.muscle_groups.length > 0) {
          const { error: insertError } = await supabase
            .from('exercise_muscle_groups')
            .insert(
              updates.muscle_groups.map(mg => ({
                exercise_id: exerciseId,
                muscle_group_id: mg.muscle_group.id,
                is_primary: mg.is_primary,
              }))
            );

          if (insertError) throw insertError;
        }
      }

      // Step 4: Fetch the updated exercise to get the new data with all relations
      const { data: updatedExercise, error: fetchError } = await supabase
        .from('exercises')
        .select(`
          id,
          name,
          description,
          equipment_type:equipment_type_id(*),
          body_part:body_part_id(*),
          is_compound,
          is_plate_loaded,
          muscle_groups:exercise_muscle_groups(
            muscle_group:muscle_group_id(*),
            is_primary
          ),
          defaults:exercise_defaults!exercise_id(
            id,
            sets,
            reps,
            weight,
            weight_increment,
            rep_increment,
            bar_weight
          )
        `)
        .eq('id', exerciseId)
        .eq('defaults.user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      // Update the local state immediately
      setExercises(prev => 
        prev.map(ex => 
          ex.id === exerciseId 
            ? { ...updatedExercise, defaults: updatedExercise.defaults[0] || null }
            : ex
        )
      );

      toast.success('Exercise updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating exercise:', error);
      toast.error('Failed to update exercise');
      return false;
    }
  };

  useEffect(() => {
    loadExerciseData();
  }, [user]);

  return {
    exercises,
    equipmentTypes,
    bodyParts,
    muscleGroups,
    loading,
    loadExerciseData,
    updateExercise,
  };
};