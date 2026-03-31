import { supabase } from './supabase';
import { TemplateExportEnvelope, ExportedTemplate } from './templateExport';

export interface UnresolvedExercise {
  original_name: string;
  template_name: string;
  order_index: number;
}

export interface AvailableExercise {
  id: string;
  name: string;
}

export interface ParsedImport {
  templates: ExportedTemplate[];
  unresolved: UnresolvedExercise[];
  availableExercises: AvailableExercise[];
}

export interface ResolutionMap {
  [key: string]: string | null;
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

function parseJSON(text: string): ExportedTemplate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON file. Please check the file format.');
  }

  if (typeof parsed !== 'object' || parsed === null || !('templates' in parsed)) {
    throw new Error('JSON file is missing the "templates" array. Please use the correct format.');
  }

  const envelope = parsed as TemplateExportEnvelope;

  if (!Array.isArray(envelope.templates)) {
    throw new Error('The "templates" field must be an array.');
  }

  return envelope.templates;
}

function parseCSV(text: string): ExportedTemplate[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('CSV file has no data rows.');

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const requiredColumns = [
    'template name',
    'template type',
    'category',
    'exercise name',
    'default sets',
    'default reps',
    'default weight (kg)',
  ];
  for (const col of requiredColumns) {
    if (!header.includes(col)) {
      throw new Error(`CSV is missing the required column: "${col}". Please use the correct format.`);
    }
  }

  const idx = (name: string) => header.indexOf(name);

  function parseCSVRow(row: string): string[] {
    const result: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') {
        if (inQuotes && row[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(field.trim());
        field = '';
      } else {
        field += ch;
      }
    }
    result.push(field.trim());
    return result;
  }

  const templateMap = new Map<string, ExportedTemplate>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVRow(lines[i]);
    const name = cols[idx('template name')]?.trim();
    if (!name) continue;

    if (!templateMap.has(name)) {
      templateMap.set(name, {
        name,
        description: cols[idx('description')]?.trim() || null,
        template_type: (cols[idx('template type')]?.trim() as 'regular' | 'superset') ?? 'regular',
        category: cols[idx('category')]?.trim() ?? 'Whole Body',
        exercises: [],
      });
    }

    const exerciseName = cols[idx('exercise name')]?.trim();
    if (!exerciseName) continue;

    const template = templateMap.get(name)!;
    template.exercises.push({
      order_index: parseInt(cols[idx('exercise order')]?.trim() ?? '0') || template.exercises.length,
      exercise_name: exerciseName,
      default_sets: parseInt(cols[idx('default sets')]?.trim() ?? '3') || 3,
      default_reps: parseInt(cols[idx('default reps')]?.trim() ?? '10') || 10,
      default_weight: parseFloat(cols[idx('default weight (kg)')]?.trim() ?? '0') || 0,
    });
  }

  const templates = Array.from(templateMap.values());
  if (templates.length === 0) throw new Error('No valid templates found in the CSV file.');
  return templates;
}

export async function parseTemplateFile(file: File): Promise<ParsedImport> {
  const text = await file.text();

  if (!text.trim()) {
    throw new Error('The file is empty.');
  }

  let templates: ExportedTemplate[];
  const ext = file.name.toLowerCase();

  if (ext.endsWith('.json')) {
    templates = parseJSON(text);
  } else if (ext.endsWith('.csv')) {
    templates = parseCSV(text);
  } else {
    throw new Error('Unsupported file type. Please upload a .json or .csv file.');
  }

  const { data: exercises, error } = await supabase
    .from('exercises')
    .select('id, name')
    .order('name');

  if (error) throw error;

  const availableExercises: AvailableExercise[] = exercises ?? [];
  const exerciseNameMap = new Map(availableExercises.map((e) => [e.name.toLowerCase(), e.id]));

  const unresolved: UnresolvedExercise[] = [];

  for (const template of templates) {
    for (const ex of template.exercises) {
      if (!ex.exercise_name) continue;
      if (!exerciseNameMap.has(ex.exercise_name.toLowerCase())) {
        unresolved.push({
          original_name: ex.exercise_name,
          template_name: template.name,
          order_index: ex.order_index,
        });
      }
    }
  }

  return { templates, unresolved, availableExercises };
}

export async function commitTemplateImport(
  userId: string,
  templates: ExportedTemplate[],
  resolutions: ResolutionMap,
  availableExercises: AvailableExercise[]
): Promise<ImportResult> {
  const exerciseNameMap = new Map(availableExercises.map((e) => [e.name.toLowerCase(), e.id]));

  let imported = 0;
  let skipped = 0;

  for (const template of templates) {
    const { data: newTemplate, error: templateError } = await supabase
      .from('workout_templates')
      .insert({
        user_id: userId,
        name: template.name,
        description: template.description,
        template_type: template.template_type,
        category: template.category,
        is_hidden: false,
        is_favorite: false,
      })
      .select('id')
      .single();

    if (templateError) throw templateError;

    const exerciseRows: Array<{
      template_id: string;
      exercise_id: string;
      order_index: number;
      default_sets: number;
      default_reps: number;
      default_weight: number;
    }> = [];

    for (const ex of template.exercises) {
      if (!ex.exercise_name) continue;

      const key = `${template.name}::${ex.exercise_name}::${ex.order_index}`;
      let exerciseId: string | null | undefined;

      if (resolutions[key] !== undefined) {
        exerciseId = resolutions[key];
      } else {
        exerciseId = exerciseNameMap.get(ex.exercise_name.toLowerCase()) ?? null;
      }

      if (!exerciseId) {
        skipped++;
        continue;
      }

      exerciseRows.push({
        template_id: newTemplate.id,
        exercise_id: exerciseId,
        order_index: ex.order_index,
        default_sets: ex.default_sets,
        default_reps: ex.default_reps,
        default_weight: ex.default_weight,
      });
    }

    if (exerciseRows.length > 0) {
      const { error: exError } = await supabase
        .from('template_exercises')
        .insert(exerciseRows);
      if (exError) throw exError;
    }

    imported++;
  }

  return { imported, skipped };
}
