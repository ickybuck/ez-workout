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
import { matchExercise, type ExerciseMatch } from './matchExercise';
import type { Identity } from './identity';
import type { Client } from './supabase';
import { scopeFor, type OwnedWorkout, type UserScope } from './userScope';

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

export interface Ctx {
  readonly identity: Identity;
  readonly scope: UserScope;
  unit(): Promise<WeightUnit>;
  settings(): Promise<Settings | null>;
  library(): Promise<LibraryExercise[]>;
  defaults(): Promise<Map<string, ExerciseDefault>>;
  /** Name in, exercise out -- or a refusal naming the candidates. */
  resolveExercise(name: string): Promise<ExerciseMatch<LibraryExercise>>;
  /** The workout with no end_time, if one is running. */
  activeWorkout(): Promise<OwnedWorkout | null>;
  /** A weight as the caller said it, in kilograms for storage. */
  toStorage(weight: number, unit?: WeightUnit): Promise<number>;
}

/** Memoises a promise-returning function so each request loads once. */
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    pending ??= load();
    return pending;
  };
}

export function createContext(client: Client, identity: Identity): Ctx {
  const scope = scopeFor(client, identity.userId);

  const settings = once(async (): Promise<Settings | null> => {
    const { data, error } = await scope
      .own('user_settings', 'weight_unit, rest_timer_duration, rest_timer_duration_extended, first_name')
      .maybeSingle();
    if (error) throw error;
    return (data as Settings) ?? null;
  });

  const unit = once(async (): Promise<WeightUnit> => {
    const stored = (await settings())?.weight_unit;
    // The app's own default when nothing is stored, matching useWeightUnit.
    return stored === 'lb' ? 'lb' : 'kg';
  });

  const library = once(async (): Promise<LibraryExercise[]> => {
    return fetchAllPages<LibraryExercise>((from, to) =>
      scope
        .shared('exercises', 'id, name, is_plate_loaded, is_compound')
        .order('name')
        .order('id')
        .range(from, to),
    );
  });

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
  });

  return {
    identity,
    scope,
    unit,
    settings,
    library,
    defaults,

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

    async toStorage(weight, given) {
      const from = given ?? (await unit());
      // Deliberately toKg, not parseInput: the caller handed us a number, and
      // rounding to storage resolution happens on the way into the column.
      return Number(toKg(weight, from).toFixed(3));
    },
  };
}
