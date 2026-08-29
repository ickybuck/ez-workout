/**
 * Assembling the export bundle — the database side of the round trip.
 *
 * Kept apart from `templateBundle.ts` on purpose: that module is pure and
 * heavily tested, and it stays that way by never learning what Supabase is.
 * This module knows about queries and nothing about validation.
 */

import { supabase } from './supabase';
import { fromKg, type WeightUnit } from './weight';
import {
  BUNDLE_SCHEMA_VERSION,
  type BundleTemplate,
  type CatalogueExercise,
  type PerformanceSummary,
  type TemplateBundle,
  type TemplateCategory,
  type TemplateType,
} from './templateBundle';

/** Weights land in the bundle at the precision a person would write. */
function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * The exercises a model is allowed to choose from.
 *
 * Hidden exercises are left out. Someone who has hidden an exercise has said
 * they do not want to see it offered, and an AI reintroducing it into a fresh
 * template would quietly undo that.
 */
export async function fetchCatalogue(userId: string): Promise<CatalogueExercise[]> {
  // Two queries rather than one with an embedded filter. Hiding lives on
  // exercise_defaults, which is per-user, so the natural-looking single query
  // would filter on an embedded resource — and a bad value there does not
  // error, it silently stops filtering. That failure mode has already cost
  // this codebase once (EZ-09, TemplateEdit); two plain queries cannot do it.
  const [{ data: exercises, error }, { data: defaults, error: defaultsError }] = await Promise.all([
    supabase
      .from('exercises')
      .select('id, name, equipment_type:equipment_type_id(name), body_part:body_part_id(name)')
      .order('name'),
    supabase.from('exercise_defaults').select('exercise_id, hidden').eq('user_id', userId),
  ]);

  if (error) throw error;
  if (defaultsError) throw defaultsError;

  const hidden = new Set(
    (defaults ?? []).filter((d) => d.hidden && d.exercise_id).map((d) => d.exercise_id as string),
  );

  return (exercises ?? [])
    .filter((row) => !!row.name && !hidden.has(row.id))
    .map((row) => {
      const equipment = row.equipment_type as { name?: string } | null;
      const bodyPart = row.body_part as { name?: string } | null;
      return {
        name: row.name,
        equipment: equipment?.name ?? null,
        body_part: bodyPart?.name ?? null,
      };
    });
}

interface TemplateRow {
  name: string;
  description: string | null;
  template_type: string | null;
  category: string | null;
  is_hidden: boolean | null;
  exercises: Array<{
    order_index: number | null;
    default_sets: number | null;
    default_reps: number | null;
    default_weight: number | null;
    exercise: { name: string } | null;
  }> | null;
}

/**
 * The user's templates, in bundle shape.
 *
 * Note what is NOT filtered here. The existing export drops any exercise whose
 * equipment type failed to join, which silently shortens a template rather than
 * failing — the export looks fine and is missing exercises. Only a missing
 * exercise NAME disqualifies a row here, because that is the one field the
 * bundle genuinely cannot do without.
 */
export async function fetchTemplatesForBundle(
  userId: string,
  unit: WeightUnit,
  { includeHidden = false } = {},
): Promise<BundleTemplate[]> {
  const { data, error } = await supabase
    .from('workout_templates')
    .select(
      `name, description, template_type, category, is_hidden,
       exercises:template_exercises(
         order_index, default_sets, default_reps, default_weight,
         exercise:exercise_id(name)
       )`,
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown as TemplateRow[])
    .filter((row) => includeHidden || !row.is_hidden)
    .map((row) => ({
      name: row.name,
      description: row.description,
      template_type: (row.template_type === 'superset' ? 'superset' : 'regular') as TemplateType,
      category: (row.category ?? 'Whole Body') as TemplateCategory,
      exercises: (row.exercises ?? [])
        .filter((ex) => !!ex.exercise?.name)
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((ex, index) => ({
          order_index: index,
          exercise_name: ex.exercise!.name,
          default_sets: ex.default_sets ?? 3,
          default_reps: ex.default_reps ?? 10,
          default_weight: round(fromKg(ex.default_weight ?? 0, unit)),
        })),
    }));
}

interface LogRow {
  weight: number | null;
  reps: number | null;
  failed_reps: number | null;
  created_at: string | null;
  workout_exercise: {
    exercise: { name: string } | null;
    workout: { user_id: string; end_time: string | null } | null;
  } | null;
}

/**
 * A per-exercise performance summary, so a model can programme from real
 * numbers rather than guessing at starting loads.
 *
 * Only finished workouts count. `end_time IS NULL` marks a session that was
 * started and abandoned, and every aggregate in this app has always excluded
 * them — including one so it could be handed to an AI as fact would be a new
 * mistake, not a continuation of an old one.
 *
 * This is training data about a person, and it only leaves the app when
 * explicitly asked for. It carries no identifiers: exercise names and numbers,
 * nothing that says whose they are.
 */
export async function fetchPerformanceSummary(
  userId: string,
  unit: WeightUnit,
  { days = 180 } = {},
): Promise<PerformanceSummary[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('exercise_logs')
    .select(
      `weight, reps, failed_reps, created_at,
       workout_exercise:workout_exercise_id(
         exercise:exercise_id(name),
         workout:workout_id(user_id, end_time)
       )`,
    )
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const byExercise = new Map<
    string,
    {
      sessions: Set<string>;
      bestWeight: number;
      recentWeight: number;
      recentReps: number;
      lastPerformed: string | null;
      prescribed: number;
      failed: number;
    }
  >();

  for (const row of (data ?? []) as unknown as LogRow[]) {
    const name = row.workout_exercise?.exercise?.name;
    const workout = row.workout_exercise?.workout;

    // Belt and braces on ownership. RLS already restricts these rows to the
    // signed-in user, but this file's whole purpose is producing something the
    // user will hand to a third party, so it does not rely on that alone.
    if (!name || !workout || workout.user_id !== userId || !workout.end_time) continue;

    const weight = row.weight ?? 0;
    const reps = row.reps ?? 0;
    const day = (row.created_at ?? '').slice(0, 10);

    const entry = byExercise.get(name) ?? {
      sessions: new Set<string>(),
      bestWeight: 0,
      recentWeight: 0,
      recentReps: 0,
      lastPerformed: null,
      prescribed: 0,
      failed: 0,
    };

    if (day) entry.sessions.add(day);
    entry.bestWeight = Math.max(entry.bestWeight, weight);
    // Rows arrive oldest first, so the last one seen is the most recent.
    entry.recentWeight = weight;
    entry.recentReps = reps;
    entry.lastPerformed = row.created_at;
    entry.prescribed += reps + (row.failed_reps ?? 0);
    entry.failed += row.failed_reps ?? 0;

    byExercise.set(name, entry);
  }

  return Array.from(byExercise.entries())
    .map(([exercise_name, e]) => ({
      exercise_name,
      sessions: e.sessions.size,
      last_performed: e.lastPerformed,
      best_weight: round(fromKg(e.bestWeight, unit)),
      recent_weight: round(fromKg(e.recentWeight, unit)),
      recent_reps: e.recentReps,
      failed_rep_rate: e.prescribed > 0 ? e.failed / e.prescribed : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

export interface BuildBundleOptions {
  userId: string;
  unit: WeightUnit;
  includePerformance?: boolean;
  includeHidden?: boolean;
}

export async function buildBundle({
  userId,
  unit,
  includePerformance = false,
  includeHidden = false,
}: BuildBundleOptions): Promise<TemplateBundle> {
  const [exercise_catalogue, templates, recent_performance] = await Promise.all([
    fetchCatalogue(userId),
    fetchTemplatesForBundle(userId, unit, { includeHidden }),
    includePerformance ? fetchPerformanceSummary(userId, unit) : Promise.resolve(undefined),
  ]);

  return {
    schema_version: BUNDLE_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    weight_unit: unit,
    exercise_catalogue,
    templates,
    proposed_exercises: [],
    ...(recent_performance ? { recent_performance } : {}),
  };
}
