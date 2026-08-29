/**
 * Applying a bundle to the database.
 *
 * The rule this module exists to enforce: **an import only ever adds.** It
 * never overwrites a template and never deletes one. Workout history points at
 * template rows, so replacing a template to "refresh" it would either orphan
 * seventeen months of sessions or take them with it.
 *
 * Refreshing therefore works by addition plus hiding — the new template is
 * created, and the superseded one can be hidden. That keeps its history intact
 * and gets it out of the way, which is the same trade already made for
 * exercises in the library. Hiding is offered, never automatic: deciding that
 * a similarly-named template supersedes another is a judgement, and the app is
 * not entitled to make it silently.
 */

import { supabase } from './supabase';
import { toKg, type WeightUnit } from './weight';
import type { BundleTemplate, TemplateBundle } from './templateBundle';

export interface ResolvedExercise {
  /** As written in the bundle. */
  name: string;
  /** The exercise it matched, or null when nothing matched. */
  exerciseId: string | null;
  matchedName: string | null;
  /** True when the match needed normalisation rather than being exact. */
  fuzzy: boolean;
}

export interface TemplateCollision {
  templateName: string;
  existingId: string;
}

export interface ImportPlan {
  bundle: TemplateBundle;
  /** One entry per distinct exercise name in the bundle. */
  resolutions: ResolvedExercise[];
  collisions: TemplateCollision[];
  /** Names that matched nothing, needing a decision before importing. */
  unresolved: string[];
}

export interface CommitOptions {
  userId: string;
  plan: ImportPlan;
  /** Exercise name (as written in the bundle) to exercise id, from the user. */
  overrides?: Record<string, string | null>;
  /** Existing template ids the user chose to hide as superseded. */
  hideTemplateIds?: string[];
}

export interface CommitResult {
  templatesCreated: number;
  exercisesLinked: number;
  exercisesSkipped: number;
  templatesHidden: number;
}

/**
 * Reduce a name to something two spellings of the same movement share.
 *
 * Deliberately conservative: case, punctuation and spacing only. It resolves
 * "Push-Ups" against "Push Ups" and "Bench press" against "Bench Press", and
 * it will not resolve "Incline Bench Press" against "Bench Press", which is a
 * different exercise and must stay unmatched so a human sees it.
 */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function distinctExerciseNames(templates: BundleTemplate[]): string[] {
  const seen = new Map<string, string>();
  for (const template of templates) {
    for (const exercise of template.exercises) {
      const key = exercise.exercise_name.toLowerCase();
      if (!seen.has(key)) seen.set(key, exercise.exercise_name);
    }
  }
  return Array.from(seen.values());
}

/**
 * Work out what importing this bundle would do, without doing any of it.
 *
 * Separated from the commit so the review screen can show the consequences
 * first. An import that silently created eleven templates and skipped four
 * exercises would be reported as a success, which is exactly the failure that
 * made the admin screen untrustworthy (EZ-02).
 */
export async function planImport(userId: string, bundle: TemplateBundle): Promise<ImportPlan> {
  const [{ data: exercises, error }, { data: existing, error: existingError }] = await Promise.all([
    supabase.from('exercises').select('id, name'),
    supabase.from('workout_templates').select('id, name').eq('user_id', userId),
  ]);

  if (error) throw error;
  if (existingError) throw existingError;

  const exactByName = new Map<string, { id: string; name: string }>();
  const normalisedByName = new Map<string, { id: string; name: string }>();

  for (const row of exercises ?? []) {
    exactByName.set(row.name.toLowerCase(), row);
    const key = normaliseName(row.name);
    // First writer wins, so an ambiguous normalised key cannot flip between
    // runs. An exact match always beats this map anyway.
    if (!normalisedByName.has(key)) normalisedByName.set(key, row);
  }

  const resolutions: ResolvedExercise[] = distinctExerciseNames(bundle.templates).map((name) => {
    const exact = exactByName.get(name.toLowerCase());
    if (exact) return { name, exerciseId: exact.id, matchedName: exact.name, fuzzy: false };

    const near = normalisedByName.get(normaliseName(name));
    if (near) return { name, exerciseId: near.id, matchedName: near.name, fuzzy: true };

    return { name, exerciseId: null, matchedName: null, fuzzy: false };
  });

  const existingByName = new Map((existing ?? []).map((t) => [t.name.toLowerCase(), t.id]));
  const collisions: TemplateCollision[] = [];
  for (const template of bundle.templates) {
    const existingId = existingByName.get(template.name.toLowerCase());
    if (existingId) collisions.push({ templateName: template.name, existingId });
  }

  return {
    bundle,
    resolutions,
    collisions,
    unresolved: resolutions.filter((r) => !r.exerciseId).map((r) => r.name),
  };
}

/**
 * Apply the plan.
 *
 * Templates are created one at a time rather than in a batch, because a
 * template row and its exercise rows are two statements and there is no
 * transaction available from the client (EZ-12). One template failing halfway
 * therefore leaves that template short rather than corrupting the rest — and
 * the count returned is of what actually happened, not of what was attempted.
 */
export async function commitBundleImport({
  userId,
  plan,
  overrides = {},
  hideTemplateIds = [],
}: CommitOptions): Promise<CommitResult> {
  const resolved = new Map<string, string | null>();
  for (const resolution of plan.resolutions) {
    resolved.set(resolution.name.toLowerCase(), resolution.exerciseId);
  }
  for (const [name, id] of Object.entries(overrides)) {
    resolved.set(name.toLowerCase(), id);
  }

  const unit: WeightUnit = plan.bundle.weight_unit;
  let templatesCreated = 0;
  let exercisesLinked = 0;
  let exercisesSkipped = 0;

  for (const template of plan.bundle.templates) {
    const { data: created, error: templateError } = await supabase
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
    templatesCreated++;

    const rows = [];
    for (const [index, exercise] of template.exercises.entries()) {
      const exerciseId = resolved.get(exercise.exercise_name.toLowerCase()) ?? null;
      if (!exerciseId) {
        exercisesSkipped++;
        continue;
      }

      rows.push({
        template_id: created.id,
        exercise_id: exerciseId,
        order_index: index,
        default_sets: exercise.default_sets,
        default_reps: exercise.default_reps,
        // The one conversion that matters. Storage is kilograms; the bundle is
        // in whatever unit it declared. Getting this wrong is EZ-11.
        default_weight: toKg(exercise.default_weight, unit),
      });
    }

    if (rows.length > 0) {
      const { error: exerciseError } = await supabase.from('template_exercises').insert(rows);
      if (exerciseError) throw exerciseError;
      exercisesLinked += rows.length;
    }
  }

  let templatesHidden = 0;
  if (hideTemplateIds.length > 0) {
    // Checked rather than assumed. A PostgREST update that matches no rows
    // succeeds silently — the whole of EZ-02 — so the count comes from the
    // returned rows, not from the absence of an error.
    const { data: hiddenRows, error: hideError } = await supabase
      .from('workout_templates')
      .update({ is_hidden: true })
      .in('id', hideTemplateIds)
      .eq('user_id', userId)
      .select('id');

    if (hideError) throw hideError;
    templatesHidden = hiddenRows?.length ?? 0;
  }

  return { templatesCreated, exercisesLinked, exercisesSkipped, templatesHidden };
}
