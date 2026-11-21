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
 *           library with created_by for provenance. Readable by anyone,
 *           never written here.
 *
 * And then the awkward ones: workout_exercises and exercise_logs have no
 * user_id at all. Ownership runs through the parent workout. Reaching them
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
  };

  return scope;
}
