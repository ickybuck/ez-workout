/*
 * The one place a user id enters a query.
 *
 * This server runs on the service_role key, so Postgres will happily hand it
 * anybody's rows. RLS is not enforcing isolation here; this file is. Every
 * read and write a tool performs goes through a scope built for one resolved
 * identity, and there is no exported way to reach the raw client.
 *
 * Two shapes of table:
 *
 *   owned   workouts, workout_templates, exercise_defaults, user_settings --
 *           they carry user_id, so the filter is applied here and the stamp
 *           is applied on insert. A tool cannot forget either.
 *   shared  exercises, body_parts, equipment_types, muscle_groups -- a common
 *           library with created_by for provenance. Readable by anyone.
 *           Written only by an admin, and only through a handle that proves
 *           it (EZ-51): the same rule the database's RLS applies to the app,
 *           restated here because the service_role key skips RLS.
 *
 * And then the awkward ones: workout_exercises, exercise_logs and
 * template_exercises have no user_id at all. Ownership runs through the parent workout. Reaching them
 * requires first proving ownership, which returns a handle carrying a symbol
 * this module does not export -- so a handle cannot be fabricated outside
 * this file, and the type system refuses a child write without one.
 *
 * Note how ownership is proven: two plain queries, never a filter on an
 * embedded resource. EZ-09 is the reason -- a filter on an embedded table
 * does not error when it fails, it silently stops filtering, which in this
 * file would mean silently handing back somebody else's set.
 */

import { fetchAllPages, type Page } from '../src/lib/paging';
import { planReorder } from '../src/lib/templateOrder';
import type { Client } from './supabase';

const OWNED = Symbol('ez-owned');

export interface OwnedWorkout {
  readonly [OWNED]: 'workout';
  readonly id: string;
}

export interface OwnedWorkoutExercise {
  readonly [OWNED]: 'workout-exercise';
  readonly id: string;
  readonly workoutId: string;
  readonly exerciseId: string | null;
  readonly orderIndex: number;
  readonly supersetGroup: number | null;
}

export interface OwnedTemplate {
  readonly [OWNED]: 'template';
  readonly id: string;
  readonly name: string;
}

export interface OwnedTemplateExercise {
  readonly [OWNED]: 'template-exercise';
  readonly id: string;
  readonly templateId: string;
  readonly exerciseId: string | null;
  readonly orderIndex: number;
  readonly supersetGroup: number | null;
  readonly defaultSets: number | null;
  readonly defaultReps: number | null;
  readonly defaultWeight: number | null;
}

/** Proof that the caller is an admin, minted only by proveAdmin. */
export interface AdminProof {
  readonly [OWNED]: 'admin';
  readonly userId: string;
}

export class NotAdminError extends Error {
  constructor(what: string) {
    super(
      `Only an admin can ${what}. The exercise library is shared by everyone, so changes to it are limited to admins.`,
    );
    this.name = 'NotAdminError';
  }
}

export class NotYoursError extends Error {
  constructor(what: string, id: string) {
    super('No ' + what + ' ' + id + ' belongs to you.');
    this.name = 'NotYoursError';
  }
}

/** Tables with a user_id of their own. */
export type OwnedTable = 'workouts' | 'workout_templates' | 'exercise_defaults' | 'user_settings';

/** The shared reference library. Read-only from this server. */
export type SharedTable =
  | 'exercises'
  | 'body_parts'
  | 'equipment_types'
  | 'muscle_groups'
  | 'exercise_muscle_groups';

/**
 * Tables that are neither owned nor shared: they hang off a parent that
 * carries the user_id, and have no way of their own to say whose they are.
 */
export type ChildTable = 'workout_exercises' | 'exercise_logs' | 'template_exercises';

/** The parent ids a child read is confined to. Required, not optional. */
export interface ParentConstraint {
  column: 'workout_id' | 'template_id' | 'workout_exercise_id';
  /** Ids already established as this user's. */
  ids: string[];
}

export interface WorkoutExerciseRow {
  id: string;
  workout_id: string | null;
  exercise_id: string | null;
  order_index: number;
  superset_group: number | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface UserScope {
  readonly userId: string;

  /** A select on an owned table, already filtered to this user. */
  own(table: OwnedTable, columns?: string): any;
  /** A select on the shared library. No user filter, because there is none. */
  shared(table: SharedTable, columns?: string): any;
  /**
   * A select on a child table, confined to parent rows already established as
   * this user's. The constraint is a required argument rather than something
   * the caller is trusted to add afterwards -- a child read that forgets it
   * returns every user's rows, silently and with no error.
   */
  childSelect(table: ChildTable, columns: string, parent: ParentConstraint): any;
  /** Insert into an owned table with user_id stamped on every row. */
  insertOwn(table: OwnedTable, rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]>;
  /** Update rows of an owned table, filtered to this user. */
  updateOwn(table: OwnedTable, id: string, patch: Record<string, unknown>): Promise<Record<string, unknown>>;
  /** Delete one of this user's templates. Its rows cascade; workouts started from it are detached (EZ-52). */
  deleteTemplate(template: OwnedTemplate): Promise<void>;

  proveWorkout(id: string): Promise<OwnedWorkout>;
  proveTemplate(id: string): Promise<OwnedTemplate>;
  proveWorkoutExercise(id: string): Promise<OwnedWorkoutExercise>;

  /** Children of a workout. Needs the proof, by type. */
  exercisesOf(workout: OwnedWorkout): Promise<OwnedWorkoutExercise[]>;
  logsOf(we: OwnedWorkoutExercise): Promise<Record<string, unknown>[]>;
  writeLog(we: OwnedWorkoutExercise, row: Record<string, unknown>): Promise<Record<string, unknown>>;
  addWorkoutExercise(
    workout: OwnedWorkout,
    row: { exercise_id: string; order_index: number; superset_group: number | null },
  ): Promise<OwnedWorkoutExercise>;

  /** This user's targets for one exercise, created if missing. */
  upsertDefaults(exerciseId: string, patch: Record<string, unknown>): Promise<Record<string, unknown>>;

  /** Rows of a template, in order. Needs the proof, by type. */
  templateExercisesOf(template: OwnedTemplate): Promise<OwnedTemplateExercise[]>;
  addTemplateExercise(template: OwnedTemplate, row: TemplateExerciseInsert): Promise<OwnedTemplateExercise>;
  updateTemplateExercise(
    row: OwnedTemplateExercise,
    patch: { default_sets?: number | null; default_reps?: number | null; default_weight?: number | null; exercise_id?: string },
  ): Promise<void>;
  deleteTemplateExercise(row: OwnedTemplateExercise): Promise<void>;
  /**
   * Rewrite a template's order and pairing. `desired` must be exactly the
   * rows the template has now, in their new order; written in two passes so
   * a swap does not collide with the unique (template_id, order_index) index.
   */
  writeTemplateLayout(
    template: OwnedTemplate,
    desired: Array<{ id: string; superset_group: number | null }>,
  ): Promise<void>;

  proveAdmin(): Promise<AdminProof>;
  /** A new library exercise, stamped created_by this user. Admin only. */
  insertExercise(admin: AdminProof, row: Record<string, unknown>): Promise<{ id: string; name: string }>;
  updateExercise(admin: AdminProof, id: string, patch: Record<string, unknown>): Promise<{ id: string; name: string }>;
  /** Replaces an exercise's muscle groups wholesale. Admin only. */
  replaceMuscleGroups(
    admin: AdminProof,
    exerciseId: string,
    rows: Array<{ muscle_group_id: string; is_primary: boolean }>,
  ): Promise<void>;
}

export interface TemplateExerciseInsert {
  exercise_id: string;
  order_index: number;
  superset_group: number | null;
  default_sets: number | null;
  default_reps: number | null;
  default_weight: number | null;
}

const TEMPLATE_EXERCISE_COLUMNS =
  'id, template_id, exercise_id, order_index, superset_group, default_sets, default_reps, default_weight';

interface TemplateExerciseRowShape {
  id: string;
  template_id: string | null;
  exercise_id: string | null;
  order_index: number;
  superset_group: number | null;
  default_sets: number | null;
  default_reps: number | null;
  default_weight: number | null;
}

function ownedTemplateRow(templateId: string, row: TemplateExerciseRowShape): OwnedTemplateExercise {
  return {
    [OWNED]: 'template-exercise',
    id: row.id,
    templateId,
    exerciseId: row.exercise_id,
    orderIndex: row.order_index,
    supersetGroup: row.superset_group ?? null,
    defaultSets: row.default_sets,
    defaultReps: row.default_reps,
    defaultWeight: row.default_weight,
  };
}

function assertAdmin(admin: AdminProof, userId: string): void {
  // The symbol cannot be forged outside this file, but a proof minted for one
  // scope must not be reusable in another.
  if (!admin || admin[OWNED] !== 'admin' || admin.userId !== userId) {
    throw new NotAdminError('change the shared exercise library');
  }
}

function owned(workoutId: string, row: { id: string; exercise_id: string | null; order_index?: number; superset_group?: number | null }): OwnedWorkoutExercise {
  return {
    [OWNED]: 'workout-exercise',
    id: row.id,
    workoutId,
    exerciseId: row.exercise_id,
    orderIndex: row.order_index ?? 0,
    supersetGroup: row.superset_group ?? null,
  };
}

export function scopeFor(client: Client, userId: string): UserScope {
  if (!userId) {
    // A blank user id turns every eq('user_id', '') into a query matching
    // nothing, and every insert stamp into an unowned row. Both are worse
    // than failing here.
    throw new Error('scopeFor needs a user id.');
  }

  const scope: UserScope = {
    userId,

    own(table, columns = '*') {
      return (client.from(table) as any).select(columns).eq('user_id', userId);
    },

    shared(table, columns = '*') {
      return (client.from(table) as any).select(columns);
    },

    childSelect(table, columns, parent) {
      if (!parent?.ids?.length) {
        // An empty `in` list would match nothing, which looks like "no rows"
        // rather than "you asked wrongly". Callers reach here with an empty
        // list when an earlier query found nothing, and should short-circuit
        // instead of issuing a query whose result they will misread.
        throw new Error(`childSelect on ${table} needs at least one parent id.`);
      }
      return (client.from(table) as any).select(columns).in(parent.column, parent.ids);
    },

    async insertOwn(table, rows) {
      const stamped = rows.map((row) => ({ ...row, user_id: userId }));
      const { data, error } = await (client.from(table) as any).insert(stamped).select();
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },

    async updateOwn(table, id, patch) {
      const { data, error } = await (client.from(table) as any)
        .update(patch)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new NotYoursError(table + ' row', id);
      return data as Record<string, unknown>;
    },

    async deleteTemplate(template) {
      const { data, error } = await (client.from('workout_templates') as any)
        .delete()
        .eq('id', template.id)
        .eq('user_id', userId)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw new NotYoursError('template', template.id);
    },

    async proveWorkout(id) {
      const { data, error } = await client
        .from('workouts')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new NotYoursError('workout', id);
      return { [OWNED]: 'workout', id: data.id };
    },

    async proveTemplate(id) {
      const { data, error } = await client
        .from('workout_templates')
        .select('id, name')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new NotYoursError('template', id);
      return { [OWNED]: 'template', id: data.id, name: data.name };
    },

    async proveWorkoutExercise(id) {
      // Step one: which workout does it hang off? No user filter is possible
      // on this table, so this row is not yet evidence of anything.
      const { data: we, error } = await client
        .from('workout_exercises')
        .select('id, workout_id, exercise_id, order_index, superset_group')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!we?.workout_id) throw new NotYoursError('exercise in a workout', id);

      // Step two: a separate, plain query that does carry the user filter.
      // Deliberately not an embedded filter -- see the header.
      await scope.proveWorkout(we.workout_id);

      return owned(we.workout_id, we);
    },

    async exercisesOf(workout) {
      const rows = await fetchAllPages<WorkoutExerciseRow>(
        (from, to) =>
          client
            .from('workout_exercises')
            .select('id, workout_id, exercise_id, order_index, superset_group')
            .eq('workout_id', workout.id)
            .order('order_index')
            .order('id')
            .range(from, to) as unknown as PromiseLike<Page<WorkoutExerciseRow>>,
      );

      return rows.map((row) => owned(workout.id, row));
    },

    async logsOf(we) {
      return fetchAllPages<Record<string, unknown>>(
        (from, to) =>
          client
            .from('exercise_logs')
            .select('*')
            .eq('workout_exercise_id', we.id)
            .order('set_number')
            .order('id')
            .range(from, to) as unknown as PromiseLike<Page<Record<string, unknown>>>,
      );
    },

    async writeLog(we, row) {
      // set_number is the identity of a set within an exercise, so this is an
      // upsert on that pair rather than an insert: a phone that retries a
      // log_set must not leave two rows behind. Idempotency is a property of
      // the key, not of a token the caller has to remember to send.
      const { data, error } = await (client.from('exercise_logs') as any)
        .upsert({ ...row, workout_exercise_id: we.id }, { onConflict: 'workout_exercise_id,set_number' })
        .select()
        .single();
      if (error) throw error;
      return data as Record<string, unknown>;
    },

    async addWorkoutExercise(workout, row) {
      const { data, error } = await client
        .from('workout_exercises')
        .insert({ ...row, workout_id: workout.id })
        .select('id, exercise_id, order_index, superset_group')
        .single();
      if (error) throw error;
      return owned(workout.id, data);
    },

    async upsertDefaults(exerciseId, patch) {
      const { data, error } = await (client.from('exercise_defaults') as any)
        .upsert(
          { ...patch, exercise_id: exerciseId, user_id: userId, updated_at: new Date().toISOString() },
          { onConflict: 'exercise_id,user_id' },
        )
        .select()
        .single();
      if (error) throw error;
      return data as Record<string, unknown>;
    },

    async templateExercisesOf(template) {
      const rows = await fetchAllPages<TemplateExerciseRowShape>(
        (from, to) =>
          client
            .from('template_exercises')
            .select(TEMPLATE_EXERCISE_COLUMNS)
            .eq('template_id', template.id)
            .order('order_index')
            .order('id')
            .range(from, to) as unknown as PromiseLike<Page<TemplateExerciseRowShape>>,
      );
      return rows.map((row) => ownedTemplateRow(template.id, row));
    },

    async addTemplateExercise(template, row) {
      const { data, error } = await (client.from('template_exercises') as any)
        .insert({ ...row, template_id: template.id })
        .select(TEMPLATE_EXERCISE_COLUMNS)
        .single();
      if (error) throw error;
      return ownedTemplateRow(template.id, data as TemplateExerciseRowShape);
    },

    async updateTemplateExercise(row, patch) {
      // Filtered on the proven template as well as the row id, so a handle
      // can only ever reach the template it was proven against.
      const { error } = await (client.from('template_exercises') as any)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('template_id', row.templateId);
      if (error) throw error;
    },

    async deleteTemplateExercise(row) {
      const { error } = await (client.from('template_exercises') as any)
        .delete()
        .eq('id', row.id)
        .eq('template_id', row.templateId);
      if (error) throw error;
    },

    async writeTemplateLayout(template, desired) {
      const current = await scope.templateExercisesOf(template);
      const plan = planReorder(
        current.map((row) => ({ id: row.id, order_index: row.orderIndex, superset_group: row.supersetGroup })),
        desired,
      );

      for (const write of plan.park) {
        const { error } = await (client.from('template_exercises') as any)
          .update({ order_index: write.order_index })
          .eq('id', write.id)
          .eq('template_id', template.id);
        if (error) throw error;
      }
      for (const write of plan.place) {
        const { error } = await (client.from('template_exercises') as any)
          .update({ order_index: write.order_index, superset_group: write.superset_group })
          .eq('id', write.id)
          .eq('template_id', template.id);
        if (error) throw error;
      }
    },

    async proveAdmin() {
      const { data, error } = await (client.from('admin_users') as any)
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new NotAdminError('change the shared exercise library');
      return { [OWNED]: 'admin', userId };
    },

    async insertExercise(admin, row) {
      assertAdmin(admin, userId);
      const { data, error } = await (client.from('exercises') as any)
        .insert({ ...row, created_by: userId })
        .select('id, name')
        .single();
      if (error) throw error;
      return data as { id: string; name: string };
    },

    async updateExercise(admin, id, patch) {
      assertAdmin(admin, userId);
      // Provenance and identity are not editable through a patch.
      const rest = { ...patch };
      delete rest.created_by;
      delete rest.id;
      const { data, error } = await (client.from('exercises') as any)
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id, name')
        .single();
      if (error) throw error;
      return data as { id: string; name: string };
    },

    async replaceMuscleGroups(admin, exerciseId, rows) {
      assertAdmin(admin, userId);
      const { error: deleteError } = await (client.from('exercise_muscle_groups') as any)
        .delete()
        .eq('exercise_id', exerciseId);
      if (deleteError) throw deleteError;
      if (!rows.length) return;
      const { error } = await (client.from('exercise_muscle_groups') as any).insert(
        rows.map((row) => ({ ...row, exercise_id: exerciseId })),
      );
      if (error) throw error;
    },
  };

  return scope;
}
