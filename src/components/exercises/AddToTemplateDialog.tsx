import React, { useState, useEffect } from 'react';
import { X, Check, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Exercise } from '../../types/exercise';
import { toast } from 'sonner';

interface Template {
  id: string;
  name: string;
  user_id: string;
  has_exercise: boolean;
}

interface AddToTemplateDialogProps {
  exercise: Exercise;
  onClose: () => void;
  onUpdate: () => void;
}

const AddToTemplateDialog: React.FC<AddToTemplateDialogProps> = ({ exercise, onClose, onUpdate }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      // First get all templates
      const { data: templatesData, error: templatesError } = await supabase
        .from('workout_templates')
        .select('*')
        .order('name');

      if (templatesError) throw templatesError;

      // Then get all template_exercises for this exercise
      const { data: exerciseData, error: exerciseError } = await supabase
        .from('template_exercises')
        .select('template_id')
        .eq('exercise_id', exercise.id);

      if (exerciseError) throw exerciseError;

      // Create a set of template IDs that have this exercise
      const templateIdsWithExercise = new Set(exerciseData.map(te => te.template_id));

      // Combine the data
      const templatesWithStatus = templatesData.map(template => ({
        ...template,
        has_exercise: templateIdsWithExercise.has(template.id)
      }));

      setTemplates(templatesWithStatus);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const addToTemplate = async (templateId: string) => {
    try {
      // Check if exercise is already in template
      const { data: existing, error: checkError } = await supabase
        .from('template_exercises')
        .select('id')
        .eq('template_id', templateId)
        .eq('exercise_id', exercise.id)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        toast.error('Exercise is already in this template');
        return;
      }

      // Get the current highest order_index
      const { data: lastExercise, error: orderError } = await supabase
        .from('template_exercises')
        .select('order_index')
        .eq('template_id', templateId)
        .order('order_index', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (orderError) throw orderError;

      const nextOrderIndex = lastExercise ? lastExercise.order_index + 1 : 0;

      const { error: insertError } = await supabase
        .from('template_exercises')
        .insert({
          template_id: templateId,
          exercise_id: exercise.id,
          order_index: nextOrderIndex,
          default_sets: exercise.defaults?.sets || 3,
          default_reps: exercise.defaults?.reps || 10,
          default_weight: exercise.defaults?.weight || 0
        });

      if (insertError) throw insertError;

      // Update local state
      setTemplates(prev => prev.map(t => 
        t.id === templateId ? { ...t, has_exercise: true } : t
      ));

      // Notify parent to update exercise list
      onUpdate();

      toast.success('Exercise added to template');
    } catch (error) {
      console.error('Error adding exercise to template:', error);
      toast.error('Failed to add exercise to template');
    }
  };

  const removeFromTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('template_exercises')
        .delete()
        .eq('template_id', templateId)
        .eq('exercise_id', exercise.id);

      if (error) throw error;

      // Update local state
      setTemplates(prev => prev.map(t => 
        t.id === templateId ? { ...t, has_exercise: false } : t
      ));

      // Notify parent to update exercise list
      onUpdate();

      toast.success('Exercise removed from template');
    } catch (error) {
      console.error('Error removing exercise from template:', error);
      toast.error('Failed to remove exercise from template');
    }
  };

  const handleTemplateClick = (template: Template) => {
    if (template.has_exercise) {
      removeFromTemplate(template.id);
    } else {
      addToTemplate(template.id);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface-raised rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-medium">Add to Template</h3>
          <button
            onClick={onClose}
            className="text-content-subtle hover:text-content-subtle"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-accent"></div>
            </div>
          ) : templates.length === 0 ? (
            <p className="text-center text-content-subtle py-4">
              No templates available. Create a template first.
            </p>
          ) : (
            <div className="space-y-2">
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateClick(template)}
                  className={`w-full flex items-center justify-between px-4 py-2 rounded text-left transition-colors duration-150 ${
                    template.has_exercise
                      ? 'bg-positive-soft text-positive-content hover:bg-critical-soft hover:text-critical'
                      : 'hover:bg-surface focus:outline-none focus:ring-2 focus:ring-accent'
                  }`}
                >
                  <span>{template.name}</span>
                  {template.has_exercise ? (
                    <Check className="h-4 w-4 text-positive group-hover:hidden" />
                  ) : (
                    <Plus className="h-4 w-4 opacity-0 group-hover:opacity-100" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddToTemplateDialog;