/*
 * The reads behind the tools.
 *
 * Two repo-specific rules shape everything here, and both were paid for:
 *
 *   A select returns at most 1,000 rows and says nothing about it (EZ-35,
 *   EZ-39). So every list goes through fetchAllPages with an explicit range
 *   and an order that breaks ties, never a bare select.
 *
 *   A filter on an embedded resource does not error when it fails -- it stops
 *   filtering (EZ-09). So "this user's logs for this exercise" is never one
 *   query with a nested filter. It is: the user's workout ids, then the
 *   matching workout_exercises, then their logs. Three plain queries, each of
 *   which fails loudly when it fails.
 */

import { fetchAllPages } from '../src/lib/paging';
import { groupRuns, normalise } from '../src/lib/supersets';
import { performedFrom } from './planSet';
import type { Ctx } from './context';
import type { TemplateProvenance } from '../src/lib/templateProvenance';

/** PostgREST builds the filter into the URL, so `in` lists are chunked. */
const IN_CHUNK = 400;

function chunk<T>(items: T[], size = IN_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface WorkoutRow {
  id: string;
  name: string;
  start_time: string | null;
  end_time: string | null;
  template_id: string | null;
}

export interface LogRow {
  id: string;
  workout_exercise_id: string | null;
  set_number: number;
  weight: number | null;
  reps: number | null;
  failed_reps: number | null;
  extra_reps: number | null;
  completed: boolean | null;
}

export interface TemplateExerciseRow {
  id: string;
  exercise_id: string | null;
  order_index: number;
  superset_group: number | null;
  default_sets: number | null;
  default_reps: number | null;
  default_weight: number | null;
}

/** Every workout belonging to this user, newest first. */
export async function listWorkouts(ctx: Ctx, limit?: number): Promise<WorkoutRow[]> {
  const rows = await fetchAllPages<WorkoutRow>((from, to) =>
    ctx.scope
      .own('workouts', 'id, name, start_time, end_time, template_id')
      .order('start_time', { ascending: false })
      .order('id')
      .range(from, to),
  );

  return typeof limit === 'number' ? rows.slice(0, limit) : rows;
}

/**
 * The user's workout_exercises rows for one exercise.
 *
 * Scoped by workout id rather than by a filter through the join, for the
 * reason in the header. The ids come from listWorkouts, which is already
 * filtered to this user by the scope.
 */
export async function workoutExercisesForExercise(
  ctx: Ctx,
  exerciseId: string,
  workouts: WorkoutRow[],
): Promise<Array<{ id: string; workout_id: string | null }>> {
  if (!workouts.length) return [];

  const found: Array<{ id: string; workout_id: string | null }> = [];

  for (const ids of chunk(workouts.map((w) => w.id))) {
    const page = await fetchAllPages<{ id: string; workout_id: string | null }>((from, to) =>
      ctx.scope
        .childSelect('workout_exercises', 'id, workout_id', { column: 'workout_id', ids })
        .eq('exercise_id', exerciseId)
        .order('id')
        .range(from, to),
    );

    found.push(...page);
  }

  return found;
}

/** Logs for a set of workout_exercise ids, already proven to be the user's. */
export async function logsFor(ctx: Ctx, workoutExerciseIds: string[]): Promise<LogRow[]> {
  if (!workoutExerciseIds.length) return [];

  const out: LogRow[] = [];

  for (const ids of chunk(workoutExerciseIds)) {
    const page = await fetchAllPages<LogRow>((from, to) =>
      ctx.scope
        .childSelect(
          'exercise_logs',
          'id, workout_exercise_id, set_number, weight, reps, failed_reps, extra_reps, completed',
          { column: 'workout_exercise_id', ids },
        )
        .order('workout_exercise_id')
        .order('set_number')
        .order('id')
        .range(from, to),
    );

    out.push(...page);
  }

  return out;
}

export interface SessionHistory {
  workout: WorkoutRow;
  sets: Array<{ setNumber: number; weightKg: number | null; performed: number; prescribed: number }>;
}

/** Recent sessions in which this exercise was performed, newest first. */
export async function exerciseHistory(ctx: Ctx, exerciseId: string, sessions: number): Promise<SessionHistory[]> {
  const workouts = await listWorkouts(ctx);
  const byId = new Map(workouts.map((w) => [w.id, w]));

  const wes = await workoutExercisesForExercise(ctx, exerciseId, workouts);
  if (!wes.length) return [];

  const logs = await logsFor(
    ctx,
    wes.map((we) => we.id),
  );

  const weToWorkout = new Map(wes.map((we) => [we.id, we.workout_id]));
  const grouped = new Map<string, SessionHistory>();

  for (const log of logs) {
    const workoutId = log.workout_exercise_id ? weToWorkout.get(log.workout_exercise_id) : null;
    const workout = workoutId ? byId.get(workoutId) : undefined;
    if (!workout) continue;

    let entry = grouped.get(workout.id);
    if (!entry) {
      entry = { workout, sets: [] };
      grouped.set(workout.id, entry);
    }

    entry.sets.push({
      setNumber: log.set_number,
      weightKg: log.weight,
      performed: performedFrom(log),
      prescribed: log.reps ?? 0,
    });
  }

  // listWorkouts is already newest first, so walking it keeps that order
  // without re-sorting on a nullable start_time.
  const ordered: SessionHistory[] = [];
  for (const workout of workouts) {
    const entry = grouped.get(workout.id);
    if (entry) {
      entry.sets.sort((a, b) => a.setNumber - b.setNumber);
      ordered.push(entry);
    }
    if (ordered.length >= sessions) break;
  }

  return ordered;
}

export interface TemplateDetail extends TemplateProvenance {
  id: string;
  name: string;
  category: string;
  templateType: string;
  isHidden: boolean;
  isFavorite: boolean;
  /** Blocks: one exercise for a straight set, several for a superset. */
  blocks: Array<Array<TemplateExerciseRow & { exerciseName: string }>>;
}

export async function templateDetails(ctx: Ctx, includeHidden: boolean): Promise<TemplateDetail[]> {
  const templates = await fetchAllPages<{
    id: string;
    name: string;
    category: string;
    template_type: string;
    is_hidden: boolean | null;
    is_favorite: boolean | null;
    created_via: string | null;
    last_edited_via: string | null;
    last_edited_at: string | null;
  }>((from, to) =>
    ctx.scope
      .own(
        'workout_templates',
        'id, name, category, template_type, is_hidden, is_favorite, created_via, last_edited_via, last_edited_at',
      )
      .order('name')
      .order('id')
      .range(from, to),
  );

  const wanted = templates.filter((t) => includeHidden || !t.is_hidden);
  if (!wanted.length) return [];

  const library = new Map((await ctx.library()).map((e) => [e.id, e.name]));

  const rows = await fetchAllPages<TemplateExerciseRow & { template_id: string | null }>((from, to) =>
    ctx.scope
      .childSelect(
        'template_exercises',
        'id, template_id, exercise_id, order_index, superset_group, default_sets, default_reps, default_weight',
        { column: 'template_id', ids: wanted.map((t) => t.id) },
      )
      .order('template_id')
      .order('order_index')
      .order('id')
      .range(from, to),
  );

  return wanted.map((template) => {
    const mine = rows
      .filter((r) => r.template_id === template.id)
      .sort((a, b) => a.order_index - b.order_index);

    // normalise() dissolves a group that is not contiguous, which is the same
    // rule the app and the importer apply -- you cannot alternate between two
    // exercises with a third in between.
    const ordered = normalise(mine);

    return {
      id: template.id,
      name: template.name,
      category: template.category,
      templateType: template.template_type,
      isHidden: !!template.is_hidden,
      isFavorite: !!template.is_favorite,
      created_via: template.created_via,
      last_edited_via: template.last_edited_via,
      last_edited_at: template.last_edited_at,
      blocks: groupRuns(ordered).map((run) =>
        run.map((row) => ({ ...row, exerciseName: library.get(row.exercise_id ?? '') ?? 'unknown exercise' })),
      ),
    };
  });
}
