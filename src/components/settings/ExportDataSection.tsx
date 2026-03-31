import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Download, FileJson, FileText, Loader2, Upload, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import {
  getWorkoutCount,
  fetchWorkoutsForExport,
  exportAsJSON,
  exportAsCSV,
} from '../../lib/workoutExport';
import { supabase } from '../../lib/supabase';
import { WorkoutTemplate } from '../../types/template';
import ExportConfirmDialog from '../templates/ExportConfirmDialog';
import ExerciseResolutionModal from '../templates/ExerciseResolutionModal';
import TemplateFormatGuide from '../templates/TemplateFormatGuide';
import {
  parseTemplateFile,
  commitTemplateImport,
  UnresolvedExercise,
  AvailableExercise,
} from '../../lib/templateImport';
import { ExportedTemplate } from '../../lib/templateExport';

type DatePreset = '30d' | '90d' | '6m' | 'all';

interface ExportDataSectionProps {
  expanded: boolean;
  onToggle: () => void;
  weightUnit: 'kg' | 'lb';
}

interface PendingImport {
  templates: ExportedTemplate[];
  unresolved: UnresolvedExercise[];
  availableExercises: AvailableExercise[];
}

function getPresetDates(preset: DatePreset): { start: string | null; end: string | null } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  if (preset === 'all') return { start: null, end: null };

  const start = new Date(now);
  if (preset === '30d') start.setDate(start.getDate() - 30);
  else if (preset === '90d') start.setDate(start.getDate() - 90);
  else if (preset === '6m') start.setMonth(start.getMonth() - 6);

  return { start: start.toISOString().split('T')[0], end: today };
}

const ExportDataSection: React.FC<ExportDataSectionProps> = ({
  expanded,
  onToggle,
  weightUnit,
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preset, setPreset] = useState<DatePreset>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [workoutCount, setWorkoutCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null);

  const [allTemplates, setAllTemplates] = useState<WorkoutTemplate[]>([]);
  const [exportTarget, setExportTarget] = useState<WorkoutTemplate[] | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  const [importing, setImporting] = useState(false);

  const getActiveDates = useCallback((): { start: string | null; end: string | null } => {
    if (preset === 'all' && !customStart && !customEnd) return { start: null, end: null };
    if (customStart || customEnd) return { start: customStart || null, end: customEnd || null };
    return getPresetDates(preset);
  }, [preset, customStart, customEnd]);

  useEffect(() => {
    if (!expanded || !user) return;

    const fetchCount = async () => {
      setCountLoading(true);
      try {
        const { start, end } = getActiveDates();
        const result = await getWorkoutCount(user.id, start, end);
        setWorkoutCount(result.count);
      } catch {
        setWorkoutCount(null);
      } finally {
        setCountLoading(false);
      }
    };

    fetchCount();
  }, [expanded, user, getActiveDates]);

  useEffect(() => {
    if (!expanded || !user) return;

    const loadTemplates = async () => {
      try {
        const { data, error } = await supabase
          .from('workout_templates')
          .select(`
            *,
            exercises:template_exercises(
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
                )
              )
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const valid = data.map((t: any) => ({
          ...t,
          exercises: (t.exercises ?? [])
            .filter((ex: any) => ex?.exercise && ex.exercise?.equipment_type)
            .sort((a: any, b: any) => a.order_index - b.order_index),
        }));

        setAllTemplates(valid);
      } catch {
        setAllTemplates([]);
      }
    };

    loadTemplates();
  }, [expanded, user]);

  const handlePresetClick = (p: DatePreset) => {
    setPreset(p);
    setCustomStart('');
    setCustomEnd('');
  };

  const handleCustomDateChange = (field: 'start' | 'end', value: string) => {
    if (field === 'start') setCustomStart(value);
    else setCustomEnd(value);
  };

  const handleExport = async (format: 'json' | 'csv') => {
    if (!user) return;
    setExporting(format);

    try {
      const { start, end } = getActiveDates();
      const workouts = await fetchWorkoutsForExport(user.id, start, end, weightUnit);

      if (workouts.length === 0) {
        toast.error('No workouts found for the selected date range');
        return;
      }

      if (format === 'json') {
        exportAsJSON(workouts, weightUnit);
      } else {
        exportAsCSV(workouts, weightUnit);
      }

      toast.success(`Exported ${workouts.length} workout${workouts.length !== 1 ? 's' : ''} as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data. Please try again.');
    } finally {
      setExporting(null);
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
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to import templates');
    } finally {
      setImporting(false);
    }
  };

  const presets: { label: string; value: DatePreset }[] = [
    { label: 'Last 30 Days', value: '30d' },
    { label: 'Last 90 Days', value: '90d' },
    { label: 'Last 6 Months', value: '6m' },
    { label: 'All Time', value: 'all' },
  ];

  const isCustomActive = !!(customStart || customEnd);

  return (
    <div className="pt-6 border-t">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="text-lg font-medium text-gray-900">Export Data</h3>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-5">
          <p className="text-sm text-gray-500">
            Download your complete workout history in your preferred format. Weights are exported in{' '}
            <span className="font-medium text-gray-700">{weightUnit}</span>.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.value}
                  onClick={() => handlePresetClick(p.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    preset === p.value && !isCustomActive
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => handleCustomDateChange('start', e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => handleCustomDateChange('end', e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            {countLoading ? (
              <span className="flex items-center gap-1.5 text-gray-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Counting workouts...
              </span>
            ) : workoutCount !== null ? (
              <span className="text-gray-600">
                <span className="font-semibold text-gray-900">{workoutCount}</span>{' '}
                {workoutCount === 1 ? 'workout' : 'workouts'} found in selected range
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <button
                onClick={() => handleExport('json')}
                disabled={!!exporting || workoutCount === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {exporting === 'json' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileJson className="h-4 w-4 text-blue-600" />
                )}
                Export JSON
              </button>
              <p className="text-xs text-gray-400 text-center">Structured, AI-friendly, full detail</p>
            </div>

            <div className="space-y-1.5">
              <button
                onClick={() => handleExport('csv')}
                disabled={!!exporting || workoutCount === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {exporting === 'csv' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 text-green-600" />
                )}
                Export CSV
              </button>
              <p className="text-xs text-gray-400 text-center">Compatible with Strong, Hevy, spreadsheets</p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-700">Workout Templates</p>
              <button
                onClick={() => setShowFormatGuide(true)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                title="Import format guide"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Export your templates as JSON or CSV, or import templates from a file.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => allTemplates.length > 0 ? setExportTarget(allTemplates) : toast.error('No templates to export')}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
              >
                <Download className="h-4 w-4 text-gray-500" />
                Export Templates
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 text-gray-500" />
                )}
                Import Templates
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv"
        className="hidden"
        onChange={handleFileSelected}
      />

      {exportTarget && (
        <ExportConfirmDialog
          templates={exportTarget}
          label={`All templates (${exportTarget.length})`}
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

export default ExportDataSection;
