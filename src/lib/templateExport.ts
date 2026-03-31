import { WorkoutTemplate } from '../types/template';

export interface TemplateExportEnvelope {
  schema_version: string;
  exported_at: string;
  templates: ExportedTemplate[];
}

export interface ExportedTemplate {
  name: string;
  description: string | null;
  template_type: 'regular' | 'superset';
  category: string;
  exercises: ExportedTemplateExercise[];
}

export interface ExportedTemplateExercise {
  order_index: number;
  exercise_name: string;
  default_sets: number;
  default_reps: number;
  default_weight: number;
}

function buildEnvelope(templates: WorkoutTemplate[]): TemplateExportEnvelope {
  return {
    schema_version: '1.0',
    exported_at: new Date().toISOString(),
    templates: templates.map((t) => ({
      name: t.name,
      description: t.description,
      template_type: t.template_type,
      category: t.category,
      exercises: t.exercises.map((ex) => ({
        order_index: ex.order_index,
        exercise_name: ex.exercise?.name ?? '',
        default_sets: ex.default_sets,
        default_reps: ex.default_reps,
        default_weight: ex.default_weight,
      })),
    })),
  };
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(value: string | null | undefined): string {
  const str = value ?? '';
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function exportTemplatesAsJSON(
  templates: WorkoutTemplate[],
  filename?: string
): void {
  const envelope = buildEnvelope(templates);
  const blob = new Blob([JSON.stringify(envelope, null, 2)], {
    type: 'application/json',
  });
  triggerDownload(blob, filename ?? `templates-${formatDate()}.json`);
}

export function exportTemplatesAsCSV(
  templates: WorkoutTemplate[],
  filename?: string
): void {
  const headers = [
    'Template Name',
    'Description',
    'Template Type',
    'Category',
    'Exercise Order',
    'Exercise Name',
    'Default Sets',
    'Default Reps',
    'Default Weight (kg)',
  ];

  const rows: string[][] = [headers];

  for (const template of templates) {
    if (template.exercises.length === 0) {
      rows.push([
        csvEscape(template.name),
        csvEscape(template.description),
        template.template_type,
        csvEscape(template.category),
        '',
        '',
        '',
        '',
        '',
      ]);
      continue;
    }
    for (const ex of template.exercises) {
      rows.push([
        csvEscape(template.name),
        csvEscape(template.description),
        template.template_type,
        csvEscape(template.category),
        ex.order_index.toString(),
        csvEscape(ex.exercise?.name),
        ex.default_sets.toString(),
        ex.default_reps.toString(),
        ex.default_weight.toString(),
      ]);
    }
  }

  const content = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename ?? `templates-${formatDate()}.csv`);
}

export function buildSampleJSON(): string {
  const sample: TemplateExportEnvelope = {
    schema_version: '1.0',
    exported_at: new Date().toISOString(),
    templates: [
      {
        name: 'Push Day A',
        description: 'Chest, shoulders and triceps',
        template_type: 'regular',
        category: 'Upper Body',
        exercises: [
          { order_index: 0, exercise_name: 'Bench Press', default_sets: 4, default_reps: 8, default_weight: 80 },
          { order_index: 1, exercise_name: 'Overhead Press', default_sets: 3, default_reps: 10, default_weight: 50 },
          { order_index: 2, exercise_name: 'Tricep Pushdown', default_sets: 3, default_reps: 12, default_weight: 30 },
        ],
      },
    ],
  };
  return JSON.stringify(sample, null, 2);
}

export function buildSampleCSV(): string {
  const rows = [
    ['Template Name', 'Description', 'Template Type', 'Category', 'Exercise Order', 'Exercise Name', 'Default Sets', 'Default Reps', 'Default Weight (kg)'],
    ['Push Day A', 'Chest, shoulders and triceps', 'regular', 'Upper Body', '0', 'Bench Press', '4', '8', '80'],
    ['Push Day A', 'Chest, shoulders and triceps', 'regular', 'Upper Body', '1', 'Overhead Press', '3', '10', '50'],
    ['Push Day A', 'Chest, shoulders and triceps', 'regular', 'Upper Body', '2', 'Tricep Pushdown', '3', '12', '30'],
  ];
  return rows.map((r) => r.join(',')).join('\n');
}
