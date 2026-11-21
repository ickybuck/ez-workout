/*
 * Deciding what "log ten at eighty" actually writes.
 *
 * Three questions have to be answered before a set can be stored, and none of
 * them is asked out loud in the gym:
 *
 *   Which set is this?   The next one not yet logged, unless told otherwise.
 *   What weight?         What was said; else what the previous set of this
 *                        exercise used; else the exercise default. Never a
 *                        silent zero -- zero is a real bodyweight answer and
 *                        must not be produced by a missing lookup.
 *   What was the target? From the row if the set already exists, else the
 *                        exercise default, else nothing -- in which case what
 *                        was done becomes the target rather than inventing a
 *                        shortfall.
 *
 * Pulled out of the tool so it can be tested without a database. The tool is
 * then only plumbing: fetch rows, call this, write the result.
 */

import { planSet, type SetPlan } from './planSet';

export interface ExistingLog {
  set_number: number;
  weight: number | null;
  reps: number | null;
}

export interface LogWriteInput {
  /** Sets already logged against this exercise in this workout. */
  existing: ExistingLog[];
  /** Reps actually performed. */
  performed: number;
  /** Which set, if the caller said. */
  requestedSet?: number;
  /** Weight in kilograms, if the caller gave one. */
  requestedWeightKg?: number | null;
  /** exercise_defaults.weight, in kilograms. */
  defaultWeightKg?: number | null;
  /** exercise_defaults.reps. */
  defaultReps?: number | null;
}

export interface LogWrite {
  setNumber: number;
  weightKg: number | null;
  plan: SetPlan;
  /** True when this overwrites a set already logged, which is worth saying. */
  replacing: boolean;
  /** Where the weight came from, for the confirmation line. */
  weightSource: 'given' | 'carried' | 'existing' | 'default' | 'none';
}

export function planLogWrite(input: LogWriteInput): LogWrite {
  const { existing, performed, requestedSet, requestedWeightKg, defaultWeightKg, defaultReps } = input;

  if (requestedSet != null && (!Number.isInteger(requestedSet) || requestedSet < 1)) {
    throw new Error(`Set number must be 1 or more (got ${requestedSet})`);
  }

  // The next set is one past the highest logged, not one past the count:
  // logging set 5 of an exercise with two sets must not then offer set 3.
  const highest = existing.reduce((max, row) => Math.max(max, row.set_number), 0);
  const setNumber = requestedSet ?? highest + 1;

  const already = existing.find((row) => row.set_number === setNumber);

  // Carried forward from the nearest earlier set that has a weight -- the
  // nearest, not the first, so a mid-exercise change sticks for the sets
  // after it.
  const earlier = existing
    .filter((row) => row.set_number < setNumber && row.weight != null)
    .sort((a, b) => b.set_number - a.set_number)[0];

  let weightKg: number | null;
  let weightSource: LogWrite['weightSource'];

  if (requestedWeightKg != null) {
    weightKg = requestedWeightKg;
    weightSource = 'given';
  } else if (earlier?.weight != null) {
    weightKg = earlier.weight;
    weightSource = 'carried';
  } else if (already?.weight != null) {
    weightKg = already.weight;
    weightSource = 'existing';
  } else if (defaultWeightKg != null) {
    weightKg = defaultWeightKg;
    weightSource = 'default';
  } else {
    weightKg = null;
    weightSource = 'none';
  }

  // A target already on the row wins over the exercise default: the row is
  // what this workout prescribed, and the default may have moved since.
  const prescribed = already?.reps ?? defaultReps ?? null;

  return {
    setNumber,
    weightKg,
    plan: planSet({ performed, prescribed }),
    replacing: !!already,
    weightSource,
  };
}
