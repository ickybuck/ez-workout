/*
 * What a weight change is allowed to touch.
 *
 * Until now every weight change did the same thing: it wrote the current set
 * and every set after it, then the exercise default, then every template row
 * using that exercise. That is right for one case -- "I started this exercise
 * at the wrong weight" -- and wrong for the other, which turns out to be the
 * common one here. Dropping the last set from 70 to 60 because you are tired
 * is not a decision about the programme, but it rewrote the programme anyway.
 *
 * So scope is now explicit, and propagation follows it:
 *
 *   'set'   one row. Nothing else moves. A correction, or a drop set.
 *   'rest'  this set and the ones after it, plus the exercise default and the
 *           templates. A change of plan, which is what those columns are for.
 *
 * Kept pure and kept here because this is the part worth being sure about:
 * the caller can be read, but "did that edit quietly rewrite my template"
 * cannot be seen by looking at the screen afterwards.
 */

export type WeightEditScope = 'set' | 'rest';

export interface WeightEditInput {
  workoutExerciseId: string;
  exerciseId: string;
  /** 1-based, as stored in exercise_logs.set_number. */
  setNumber: number;
  /** Storage units. Conversion is the caller's job. */
  weightKg: number;
  scope: WeightEditScope;
}

export interface WeightEditPlan {
  weightKg: number;
  exerciseId: string;
  logs: {
    workoutExerciseId: string;
    fromSetNumber: number;
    /** null means "and everything after", which is the 'rest' scope. */
    toSetNumber: number | null;
  };
  updatesDefaults: boolean;
  updatesTemplates: boolean;
  /** For the line shown to the user before it happens. */
  affects: string;
}

export function planWeightEdit(input: WeightEditInput): WeightEditPlan {
  const { workoutExerciseId, exerciseId, setNumber, weightKg, scope } = input;

  // Zero is legitimate -- every bodyweight movement -- but a negative weight
  // is always a mistake, and storing one quietly corrupts every volume figure
  // it reaches.
  if (!(weightKg >= 0)) {
    throw new Error(`Weight cannot be negative (got ${weightKg})`);
  }
  if (!Number.isInteger(setNumber) || setNumber < 1) {
    throw new Error(`Set number must be 1 or more (got ${setNumber})`);
  }

  const isRest = scope === 'rest';

  return {
    weightKg,
    exerciseId,
    logs: {
      workoutExerciseId,
      fromSetNumber: setNumber,
      toSetNumber: isRest ? null : setNumber,
    },
    updatesDefaults: isRest,
    updatesTemplates: isRest,
    affects: isRest ? 'this set, the rest, and the template' : 'this set only',
  };
}
