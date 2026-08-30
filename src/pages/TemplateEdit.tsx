import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { WorkoutTemplate } from '../types/template';
import { normalise } from '../lib/supersets';
import { Exercise } from '../types/exercise';
import TemplateForm from '../components/templates/TemplateForm';
import ExerciseList from '../components/templates/ExerciseList';
import ExerciseSelector from '../components/templates/ExerciseSelector';

const TemplateEdit: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [template, setTemplate] = useState<WorkoutTemplate>({
    id: '',
    user_id: user?.id || '',
    name: '',
    description: '',
    is_hidden: false,
    is_favorite: false,
    template_type: 'regular',
    category: 'Whole Body',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    exercises: [],
  });
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingExercises, setAddingExercises] = useState(false);

  useEffect(() => {
    if (user) {
      loadExercises();
      if (id) {
        loadTemplate();
      } else {
        setLoading(false);
      }
    }
  }, [user, id]);

  const loadTemplate = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
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
              muscle_groups:exercise_muscle_groups(
                muscle_group:muscle_group_id(*)
              ),
              defaults:exercise_defaults!exercise_id(*)
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Template not found');

      // Filter out any exercises with missing data and sort by order_index
      const validExercises = data.exercises
        .filter(ex => ex?.exercise && ex.exercise?.equipment_type)
        .sort((a, b) => a.order_index - b.order_index);

      setTemplate({
        ...data,
        exercises: validExercises,
      });
    } catch (error) {
      console.error('Error loading template:', error);
      toast.error('Failed to load template');
      navigate('/dashboard/templates');
    } finally {
      setLoading(false);
    }
  };

  const loadExercises = async () => {
    // Without this, an unresolved session sends user_id=eq.undefined as a
    // filter on an EMBEDDED resource, where a bad value does not error — it
    // silently stops filtering, so every user's defaults come back.
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('exercises')
        .select(`
          *,
          equipment_type:equipment_type_id(*),
          muscle_groups:exercise_muscle_groups(
            muscle_group:muscle_group_id(*)
          ),
          defaults:exercise_defaults!exercise_id(*)
        `)
        .eq('defaults.user_id', user.id)
        .order('name');

      if (error) throw error;

      // Filter out exercises with missing data
      const validExercises = data.filter(
        exercise => exercise && exercise.equipment_type && exercise.muscle_groups
      );

      setExercises(validExercises);
    } catch (error) {
      console.error('Error loading exercises:', error);
      toast.error('Failed to load exercises');
    }
  };

  const handleExerciseValuesChange = async (exerciseId: string, values: { sets?: number; reps?: number; weight?: number }) => {
    if (!template || !user) return;

    try {
      // Update all instances of this exercise in the template
      const updatedExercises = template.exercises.map(ex => {
        if (ex.exercise?.id === exerciseId) {
          return {
            ...ex,
            default_sets: values.sets ?? ex.default_sets,
            default_reps: values.reps ?? ex.default_reps,
            default_weight: values.weight ?? ex.default_weight,
          };
        }
        return ex;
      });

      setTemplate({
        ...template,
        exercises: updatedExercises,
      });

      // Update exercise defaults
      const { error: defaultsError } = await supabase
        .from('exercise_defaults')
        .upsert({
          exercise_id: exerciseId,
          user_id: user.id,
          sets: values.sets ?? template.exercises.find(ex => ex.exercise?.id === exerciseId)?.default_sets,
          reps: values.reps ?? template.exercises.find(ex => ex.exercise?.id === exerciseId)?.default_reps,
          weight: values.weight ?? template.exercises.find(ex => ex.exercise?.id === exerciseId)?.default_weight,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'exercise_id,user_id',
        });

      if (defaultsError) throw defaultsError;

      // Update all template exercises with this exercise_id
      const { error: templateExercisesError } = await supabase
        .from('template_exercises')
        .update({
          default_sets: values.sets,
          default_reps: values.reps,
          default_weight: values.weight,
        })
        .eq('exercise_id', exerciseId);

      if (templateExercisesError) throw templateExercisesError;

      // Refresh exercises list to get updated defaults
      loadExercises();
    } catch (error) {
      console.error('Error updating exercise values:', error);
      toast.error('Failed to update exercise values');
    }
  };

  const handleSave = async () => {
    if (!template || !user) return;

    setSaving(true);
    try {
      // Create or update the template
      const templateData = {
        user_id: user.id,
        name: template.name,
        description: template.description,
        template_type: template.template_type,
        category: template.category,
        updated_at: new Date().toISOString(),
      };

      let templateId = template.id;

      if (id) {
        // Update existing template
        const { error: templateError } = await supabase
          .from('workout_templates')
          .update(templateData)
          .eq('id', id);

        if (templateError) throw templateError;
      } else {
        // Create new template
        const { data: newTemplate, error: templateError } = await supabase
          .from('workout_templates')
          .insert(templateData)
          .select('id')
          .single();

        if (templateError) throw templateError;
        templateId = newTemplate.id;
        
        // Update local template with new ID
        setTemplate(prev => ({ ...prev, id: templateId }));
      }

      // Update exercise order and pairing. Both are positional, so they are
      // written together — a reorder that left superset_group behind would
      // leave a group whose members are no longer adjacent, which normalise
      // would then dissolve on the next read.
      const ordered = normalise(
        [...template.exercises].sort((a, b) => a.order_index - b.order_index),
      );

      for (const [index, exercise] of ordered.entries()) {
        const { error: exerciseError } = await supabase
          .from('template_exercises')
          .update({
            order_index: index,
            superset_group: exercise.superset_group ?? null,
          })
          .eq('id', exercise.id);

        if (exerciseError) throw exerciseError;
      }

      toast.success(id ? 'Template updated successfully' : 'Template created successfully');
      navigate('/dashboard/templates');
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleAddExercises = async (selectedExercises: Exercise[]) => {
    if (!user || selectedExercises.length === 0) return;

    setAddingExercises(true);
    try {
      // If this is a new template, create it first
      let templateId = template.id;
      if (!templateId) {
        const templateData = {
          user_id: user.id,
          name: template.name || 'New Template',
          description: template.description,
          template_type: template.template_type,
          category: template.category,
          updated_at: new Date().toISOString(),
        };

        const { data: newTemplate, error: templateError } = await supabase
          .from('workout_templates')
          .insert(templateData)
          .select('id')
          .single();

        if (templateError) throw templateError;
        templateId = newTemplate.id;
        
        // Update local template with new ID
        setTemplate(prev => ({ ...prev, id: templateId }));
      }

      // Get the list of exercise IDs that are already in the template
      const existingExerciseIds = new Set(template.exercises.map(ex => ex.exercise.id));

      // Filter out exercises that are already in the template
      const newExercises = selectedExercises.filter(ex => !existingExerciseIds.has(ex.id));

      if (newExercises.length === 0) {
        toast.info('All selected exercises are already in the template');
        setShowExerciseSelector(false);
        setAddingExercises(false);
        return;
      }

      const startingOrder = template.exercises.length;
      const exercisesToAdd = newExercises.map((exercise, index) => ({
        template_id: templateId,
        exercise_id: exercise.id,
        order_index: startingOrder + index,
        default_sets: exercise.defaults?.[0]?.sets || (exercise.is_compound ? 4 : 3),
        default_reps: exercise.defaults?.[0]?.reps || (exercise.is_compound ? 8 : 12),
        default_weight: exercise.defaults?.[0]?.weight || 0,
      }));

      const { data, error } = await supabase
        .from('template_exercises')
        .insert(exercisesToAdd)
        .select(`
          id,
          order_index,
          default_sets,
          default_reps,
          default_weight,
          exercise:exercise_id(
            id,
            name,
            description,
            equipment_type:equipment_type_id(*),
            is_compound,
            muscle_groups:exercise_muscle_groups(
              muscle_group:muscle_group_id(*)
            ),
            defaults:exercise_defaults!exercise_id(*)
          )
        `);

      if (error) throw error;

      setTemplate({
        ...template,
        exercises: [...template.exercises, ...data],
      });

      toast.success(`Added ${newExercises.length} exercises to template`);
      setShowExerciseSelector(false);
    } catch (error) {
      console.error('Error adding exercises:', error);
      toast.error('Failed to add exercises');
    } finally {
      setAddingExercises(false);
    }
  };

  const handleRemoveExercise = async (exerciseId: string) => {
    if (!template || !user) return;

    try {
      const { error } = await supabase
        .from('template_exercises')
        .delete()
        .eq('id', exerciseId);

      if (error) throw error;

      setTemplate({
        ...template,
        exercises: template.exercises.filter(e => e.id !== exerciseId),
      });
    } catch (error) {
      console.error('Error removing exercise:', error);
      toast.error('Failed to remove exercise');
    }
  };

  const moveExercise = (index: number, direction: 'up' | 'down') => {
    if (!template) return;

    const newExercises = [...template.exercises];
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= newExercises.length) return;

    [newExercises[index], newExercises[newIndex]] = [
      newExercises[newIndex],
      newExercises[index],
    ];

    newExercises.forEach((exercise, i) => {
      exercise.order_index = i;
    });

    setTemplate({
      ...template,
      exercises: newExercises,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  // Filter out any exercises with missing data before creating the ID list
  const addedExerciseIds = template.exercises
    .filter(ex => ex.exercise?.id)
    .map(ex => ex.exercise.id);

  return (
    <div className="max-w-7xl mx-auto px-2 py-2">
      <div className="bg-surface-raised rounded-lg shadow-md p-3">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard/templates')}
              className="text-content-muted hover:text-content"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-2xl font-bold text-content">
              {id ? 'Edit Template' : 'New Template'}
            </h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-content-inverse bg-accent hover:bg-accent-hover disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <TemplateForm
          template={template}
          onChange={setTemplate}
        />

        <ExerciseList
          template={template}
          onTemplateChange={setTemplate}
          onAddClick={() => setShowExerciseSelector(true)}
          onRemoveExercise={handleRemoveExercise}
          onMoveExercise={moveExercise}
          onExerciseValuesChange={handleExerciseValuesChange}
        />

        {showExerciseSelector && (
          <ExerciseSelector
            exercises={exercises}
            addedExerciseIds={addedExerciseIds}
            onSelect={handleAddExercises}
            onClose={() => setShowExerciseSelector(false)}
            isAdding={addingExercises}
          />
        )}
      </div>
    </div>
  );
};

export default TemplateEdit;