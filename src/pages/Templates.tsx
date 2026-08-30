import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
// Edit was aliased to CreditCard, so the edit button showed a credit card and
// read as nothing at all — the one control people look for was the one icon
// that could not be guessed. Almost certainly an auto-import picking the wrong
// symbol; corrected to a pencil.
import { ChevronDown, ChevronUp, Copy, Pencil, Plus, Star, Trash2, Info, Dumbbell, Upload, Download, HelpCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { WorkoutTemplate } from '../types/template';
import ExportConfirmDialog from '../components/templates/ExportConfirmDialog';
import ExerciseResolutionModal from '../components/templates/ExerciseResolutionModal';
import TemplateFormatGuide from '../components/templates/TemplateFormatGuide';
import {
  parseTemplateFile,
  commitTemplateImport,
  UnresolvedExercise,
  AvailableExercise,
} from '../lib/templateImport';
import { ExportedTemplate } from '../lib/templateExport';

interface ExportTarget {
  templates: WorkoutTemplate[];
  label: string;
}

interface PendingImport {
  templates: ExportedTemplate[];
  unresolved: UnresolvedExercise[];
  availableExercises: AvailableExercise[];
}

const Templates: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());

  const [exportTarget, setExportTarget] = useState<ExportTarget | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [user]);

  const loadTemplates = async () => {
    if (!user) return;

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
              )
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const validTemplates = data.map(template => ({
        ...template,
        exercises: template.exercises
          .filter((ex: any) => ex?.exercise && ex.exercise?.equipment_type)
          .sort((a: any, b: any) => a.order_index - b.order_index),
      }));

      setTemplates(validTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTemplate = async (template: WorkoutTemplate) => {
    if (!user) return;

    try {
      const { data: newTemplate, error: templateError } = await supabase
        .from('workout_templates')
        .insert({
          user_id: user.id,
          name: `${template.name} (Copy)`,
          description: template.description,
          is_hidden: false,
          is_favorite: false,
          template_type: template.template_type,
          category: template.category,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      const validExercises = template.exercises.filter(
        ex => ex?.exercise && ex.exercise?.equipment_type
      );

      // Pairing has to travel with the copy. Without it a copied template comes
      // back as every exercise a straight set — silently, since the copy looks
      // right until it is started.
      const exercisesToCopy = validExercises.map(exercise => ({
        template_id: newTemplate.id,
        exercise_id: exercise.exercise_id,
        order_index: exercise.order_index,
        superset_group: exercise.superset_group ?? null,
        default_sets: exercise.default_sets,
        default_reps: exercise.default_reps,
        default_weight: exercise.default_weight,
      }));

      if (exercisesToCopy.length > 0) {
        const { error: exercisesError } = await supabase
          .from('template_exercises')
          .insert(exercisesToCopy);

        if (exercisesError) throw exercisesError;
      }

      toast.success('Template copied successfully');
      loadTemplates();
    } catch (error) {
      console.error('Error copying template:', error);
      toast.error('Failed to copy template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('workout_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast.success('Template deleted successfully');
      setTemplates(templates.filter(t => t.id !== templateId));
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const toggleTemplate = (templateId: string) => {
    setExpandedTemplates(prev => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  const toggleFavorite = async (template: WorkoutTemplate) => {
    try {
      const { error } = await supabase
        .from('workout_templates')
        .update({
          is_favorite: !template.is_favorite,
          updated_at: new Date().toISOString()
        })
        .eq('id', template.id);

      if (error) throw error;

      setTemplates(prev =>
        prev.map(t =>
          t.id === template.id
            ? { ...t, is_favorite: !t.is_favorite }
            : t
        )
      );

      toast.success(
        template.is_favorite
          ? 'Template removed from favorites'
          : 'Template added to favorites'
      );
    } catch (error) {
      console.error('Error updating template favorite status:', error);
      toast.error('Failed to update favorite status');
    }
  };

  const moveTemplate = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= templates.length) return;

    try {
      const template1 = templates[index];
      const template2 = templates[newIndex];

      const temp = template1.created_at;
      template1.created_at = template2.created_at;
      template2.created_at = temp;

      const [updateResult1, updateResult2] = await Promise.all([
        supabase
          .from('workout_templates')
          .update({
            created_at: template1.created_at,
            updated_at: new Date().toISOString()
          })
          .eq('id', template1.id),
        supabase
          .from('workout_templates')
          .update({
            created_at: template2.created_at,
            updated_at: new Date().toISOString()
          })
          .eq('id', template2.id)
      ]);

      if (updateResult1.error) throw updateResult1.error;
      if (updateResult2.error) throw updateResult2.error;

      const newTemplates = [...templates];
      [newTemplates[index], newTemplates[newIndex]] = [newTemplates[newIndex], newTemplates[index]];
      setTemplates(newTemplates);
    } catch (error) {
      console.error('Error updating template order:', error);
      toast.error('Failed to update template order');
      loadTemplates();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImporting(true);
    try {
      const result = await parseTemplateFile(file);

      if (result.unresolved.length > 0) {
        setPendingImport(result);
      } else {
        await finishImport(result.templates, {}, result.availableExercises);
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to parse file');
    } finally {
      setImporting(false);
    }
  };

  const finishImport = async (
    templates: ExportedTemplate[],
    resolutions: Record<string, string | null>,
    availableExercises: AvailableExercise[]
  ) => {
    if (!user) return;
    setImporting(true);
    try {
      const result = await commitTemplateImport(user.id, templates, resolutions, availableExercises);
      const msg = `Imported ${result.imported} template${result.imported !== 1 ? 's' : ''}` +
        (result.skipped > 0 ? ` (${result.skipped} exercise${result.skipped !== 1 ? 's' : ''} skipped)` : '');
      toast.success(msg);
      setPendingImport(null);
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to import templates');
    } finally {
      setImporting(false);
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
    <div className="max-w-7xl mx-auto px-2 py-2">
      <div className="bg-surface-raised rounded-lg shadow-md p-3">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-content">Workout Templates</h2>
          <button
            onClick={() => navigate('/dashboard/templates/new')}
            className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-content-inverse bg-surface-overlay hover:bg-surface-overlay transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-edge">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-content-muted border border-edge rounded-lg hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="h-3.5 w-3.5" />
            Import
          </button>

          {templates.length > 0 && (
            <button
              onClick={() => setExportTarget({ templates, label: 'All templates' })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-content-muted border border-edge rounded-lg hover:bg-surface transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export All
            </button>
          )}

          <button
            onClick={() => setShowFormatGuide(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-content-subtle hover:text-content-muted hover:bg-surface rounded-lg transition-colors"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Format Guide
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv"
          className="hidden"
          onChange={handleFileSelected}
        />

        <div className="space-y-4">
          {templates.map((template, index) => (
            <div
              key={template.id}
              className="border rounded-lg hover:shadow-md transition-shadow duration-200"
            >
              <div className="p-3">
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveTemplate(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-content-subtle hover:text-content-muted disabled:opacity-30 disabled:cursor-not-allowed rounded-full hover:bg-surface-sunken"
                      title="Move up"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => moveTemplate(index, 'down')}
                      disabled={index === templates.length - 1}
                      className="p-1 text-content-subtle hover:text-content-muted disabled:opacity-30 disabled:cursor-not-allowed rounded-full hover:bg-surface-sunken"
                      title="Move down"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      <div className="flex-1 flex items-center gap-2 min-w-0 mr-4">
                        {/* Tapping the name is what everyone tries first, so it
                            opens the editor rather than doing nothing. */}
                        <button
                          onClick={() => navigate(`/dashboard/templates/${template.id}/edit`)}
                          className="text-lg font-medium text-content truncate hover:text-accent transition-colors text-left"
                          title="Edit template"
                        >
                          {template.name}
                        </button>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="px-2 py-0.5 text-sm bg-surface-sunken text-content-muted rounded-full">
                          {template.category}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2 text-sm text-content-subtle">
                        {/* The template-wide Linear/Superset label is gone. A
                            template can now be both at once, so labelling the
                            whole thing one or the other was not just useless —
                            it was wrong for any template that mixes them. */}
                        <div className="flex items-center gap-1" title={`${template.exercises.length} exercises`}>
                          <Dumbbell className="h-4 w-4 text-content-subtle" />
                          <span>{template.exercises.length}</span>
                        </div>
                      </div>

                      {/* Order: delete, export, copy, favourite, info, edit. */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="p-1.5 text-content-subtle hover:text-critical hover:bg-critical-soft rounded-full"
                          title="Delete template"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setExportTarget({ templates: [template], label: template.name })}
                          className="p-1.5 text-content-subtle hover:text-content-muted hover:bg-surface-sunken rounded-full transition-colors"
                          title="Export template"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleCopyTemplate(template)}
                          className="p-1.5 text-content-subtle hover:text-content-muted hover:bg-surface-sunken rounded-full"
                          title="Copy template"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleFavorite(template)}
                          className={`p-1.5 rounded-full hover:bg-surface-sunken ${
                            template.is_favorite
                              ? 'text-caution hover:text-caution'
                              : 'text-content-subtle hover:text-content-muted'
                          }`}
                          title={template.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Star className="h-4 w-4" fill={template.is_favorite ? 'currentColor' : 'none'} />
                        </button>
                        {/* Only when there is a description, rather than a
                            button that would expand nothing. */}
                        {template.description && (
                          <button
                            onClick={() => toggleTemplate(template.id)}
                            className="p-1.5 text-content-subtle hover:text-content-muted rounded-full hover:bg-surface-sunken transition-colors"
                            title={expandedTemplates.has(template.id) ? 'Hide details' : 'Show details'}
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/dashboard/templates/${template.id}/edit`)}
                          className="p-1.5 text-content-subtle hover:text-content-muted hover:bg-surface-sunken rounded-full"
                          title="Edit template"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {expandedTemplates.has(template.id) && (
                <>
                  {template.description && (
                    <div className="px-4 py-2 border-t bg-surface">
                      <p className="text-sm text-content-muted">{template.description}</p>
                    </div>
                  )}

                  <div className="border-t divide-y">
                    {template.exercises
                      .filter(ex => ex?.exercise && ex.exercise?.equipment_type)
                      .sort((a, b) => a.order_index - b.order_index)
                      .map((exercise, i) => (
                        <div
                          key={exercise.id}
                          className="flex items-center justify-between py-2 px-4"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-content">
                                {exercise.exercise.name}
                              </span>
                              <span className="text-xl" title={exercise.exercise.equipment_type.name}>
                                {exercise.exercise.equipment_type.emoji}
                              </span>
                              {template.template_type === 'superset' && i % 2 === 0 && i < template.exercises.length - 1 && (
                                <span className="px-1.5 py-0.5 text-xs bg-surface-sunken text-content-muted rounded">
                                  Superset
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-content-subtle">
                              {exercise.default_sets} × {exercise.default_reps}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          ))}

          {templates.length === 0 && (
            <div className="text-center py-12">
              <Dumbbell className="h-10 w-10 text-content-subtle mx-auto mb-3" />
              <p className="text-content-subtle text-sm">No templates yet. Create one or import a file.</p>
            </div>
          )}
        </div>
      </div>

      {exportTarget && (
        <ExportConfirmDialog
          templates={exportTarget.templates}
          label={exportTarget.label}
          onClose={() => setExportTarget(null)}
        />
      )}

      {pendingImport && (
        <ExerciseResolutionModal
          unresolved={pendingImport.unresolved}
          availableExercises={pendingImport.availableExercises}
          onConfirm={(resolutions) =>
            finishImport(pendingImport.templates, resolutions, pendingImport.availableExercises)
          }
          onCancel={() => setPendingImport(null)}
        />
      )}

      {showFormatGuide && (
        <TemplateFormatGuide onClose={() => setShowFormatGuide(false)} />
      )}
    </div>
  );
};

export default Templates;
