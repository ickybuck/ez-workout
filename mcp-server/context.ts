/*
 * Everything a tool needs to know about the person asking, loaded once per
 * request and shared between tools in that request.
 *
 * Three things are worth loading eagerly-but-lazily rather than per tool
 * call: the weight unit, the exercise library, and the caller's exercise
 * defaults. All three are read by nearly every tool, none of them changes
 * mid-request, and the library is the pool every name is matched against.
 *
 * The unit deserves a note. Weights are stored in kilograms and the plates in
 * this gym are in pounds, so the unit is not a formatting detail -- it is the
 * difference between 80 kg and 80 lb landing in the same column. Tools take a
 * weight plus an optional unit, and when the unit is left out it is the one
 * the person has set, not a guess and not kilograms.
 */

import { toKg, type WeightUnit } from '../src/lib/weight';
import { fetchAllPages } from '../src/lib/paging';
import { matchExercise, UnknownExerciseError, type ExerciseMatch } from './matchExercise';
import type { Identity } from './identity';
import type { Client } from './supabase';
import { scopeFor, type OwnedTemplate, type OwnedWorkout, type UserScope } from './userScope';

export interface LibraryExercise {
  id: string;
  name: string;
  is_plate_loaded: boolean | null;
  is_compound: boolean | null;
}

export interface ExerciseDefault {
  exercise_id: string | null;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  weight_increment: number | null;
  bar_weight: number | null;
  extended_rest: boolean;
  hidden: boolean;
}

export interface Settings {
  weight_unit: string | null;
  rest_timer_duration: number | null;
  rest_timer_duration_extended: number | null;
  first_name: string | null;
}

export interface TemplateSummary {
  id: string;
  name: string;
  is_hidden: boolean | null;
}

/** A name/id pair from one of the small shared reference tables. */
export interface Reference {
  id: string;
  name: string;
}

export type ReferenceTable = 'equipment_types' | 'body_parts' | 'muscle_groups';

export interface Ctx {
  readonly identity: Identity;
  readonly scope: UserScope;
  unit(): Promise<WeightUnit>;
  settings(): Promise<Settings | null>;
  library(): Promise<LibraryExercise[]>;
  defaults(): Promise<Map<string, ExerciseDefault>>;
  /** Name in, exercise out -- or a refusal naming the candidates. */
  resolveExercise(name: string): Promise<ExerciseMatch<LibraryExercise>>;
  /** This user's templates, hidden ones included. */
  templates(): Promise<TemplateSummary[]>;
  /**
   * Name in, proven template out -- hidden templates included, so they can be
   * shown again. `hidden` narrows to hidden or visible templates only, which
   * is how a hidden copy that shares a visible template's name is reached.
   */
  resolveTemplate(name: string, options?: { hidden?: boolean }): Promise<OwnedTemplate>;
  /** Equipment, body parts or muscle groups, for matching names against. */
  reference(table: ReferenceTable): Promise<Reference[]>;
  /** The workout with no end_time, if one is running. */
  activeWorkout(): Promise<OwnedWorkout | null>;
  /** A weight as the caller said it, in kilograms for storage. */
  toStorage(weight: number, unit?: WeightUnit): Promise<number>;
  /**
   * Drop everything loaded so far. Called after a tool changes the library,
   * the caller's targets or templates. Over HTTP a context lasts one request,
   * but the stdio server keeps one for the life of the process, where a
   * cached library would not know about an exercise added a minute ago.
   */
  forget(): void;
}

/** Memoises a promise-returning function so each request loads once. */
function once<T>(load: () => Promise<T>, registry: Array<() => void>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  registry.push(() => {
    pending = null;
  });
  return () => {
    pending ??= load();
    return pending;
  };
}

export function createContext(client: Client, identity: Identity): Ctx {
  const scope = scopeFor(client, identity.userId);
  const forgetters: Array<() => void> = [];

  const settings = once(async (): Promise<Settings | null> => {
    const { data, error } = await scope
      .own('user_settings', 'weight_unit, rest_timer_duration, rest_timer_duration_extended, first_name')
      .maybeSingle();
    if (error) throw error;
    return (data as Settings) ?? null;
  }, forgetters);

  const unit = once(async (): Promise<WeightUnit> => {
    const stored = (await settings())?.weight_unit;
    // The app's own default when nothing is stored, matching useWeightUnit.
    return stored === 'lb' ? 'lb' : 'kg';
  }, forgetters);

  const library = once(async (): Promise<LibraryExercise[]> => {
    return fetchAllPages<LibraryExercise>((from, to) =>
      scope
        .shared('exercises', 'id, name, is_plate_loaded, is_compound')
        .order('name')
        .order('id')
        .range(from, to),
    );
  }, forgetters);

  const defaults = once(async (): Promise<Map<string, ExerciseDefault>> => {
    const rows = await fetchAllPages<ExerciseDefault>((from, to) =>
      scope
        .own(
          'exercise_defaults',
          'exercise_id, sets, reps, weight, weight_increment, bar_weight, extended_rest, hidden',
        )
        .order('exercise_id')
        .order('id')
        .range(from, to),
    );

    const byExercise = new Map<string, ExerciseDefault>();
    for (const row of rows) if (row.exercise_id) byExercise.set(row.exercise_id, row);
    return byExercise;
  }, forgetters);

  const templates = once(async (): Promise<TemplateSummary[]> => {
    return fetchAllPages<TemplateSummary>((from, to) =>
      scope.own('workout_templates', 'id, name, is_hidden').order('name').order('id').range(from, to),
    );
  }, forgetters);

  const references = new Map<ReferenceTable, () => Promise<Reference[]>>();
  const reference = (table: ReferenceTable) => {
    let load = references.get(table);
    if (!load) {
      load = once(
        () => fetchAllPages<Reference>((from, to) => scope.shared(table, 'id, name').order('name').order('id').range(from, to)),
        forgetters,
      );
      references.set(table, load);
    }
    return load();
  };

  return {
    identity,
    scope,
    unit,
    settings,
    library,
    defaults,
    templates,
    reference,

    async resolveTemplate(name, options = {}) {
      const all = await templates();
      if (options.hidden != null) {
        const pool = all.filter((t) => !!t.is_hidden === options.hidden);
        const match = matchExercise(name, pool, {
          noun: options.hidden ? 'hidden template' : 'visible template',
          listKnown: true,
        });
        return scope.proveTemplate(match.exercise.id);
      }

      // Visible templates first. An old version is often kept hidden under
      // the same name as its replacement, and a name must reach the one on
      // the start screen; a hidden template is only reached when nothing
      // visible matches, which is how one is found to be shown again.
      const visible = all.filter((t) => !t.is_hidden);
      let match;
      try {
        match = matchExercise(name, visible, { noun: 'template' });
      } catch (error) {
        if (!(error instanceof UnknownExerciseError)) throw error;
        match = matchExercise(name, all, { noun: 'template', listKnown: true });
      }
      return scope.proveTemplate(match.exercise.id);
    },

    async resolveExercise(name) {
      return matchExercise(name, await library());
    },

    async activeWorkout() {
      const { data, error } = await scope
        .own('workouts', 'id, start_time')
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      // Round-trips through proveWorkout so the handle is minted in the one
      // place allowed to mint one, rather than cast here.
      return scope.proveWorkout((data as { id: string }).id);
    },

    forget() {
      for (const reset of forgetters) reset();
    },

    async toStorage(weight, given) {
      const from = given ?? (await unit());
      // Deliberately toKg, not parseInput: the caller handed us a number, and
      // rounding to storage resolution happens on the way into the column.
      return Number(toKg(weight, from).toFixed(3));
    },
  };
}
