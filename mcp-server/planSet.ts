/*
 * Turning "I did ten" into the four columns a set is actually stored in.
 *
 * The column names invite exactly the wrong reading, and stopReason.ts says
 * so in as many words: `reps` is the PRESCRIPTION, `failed_reps` is the
 * shortfall, `extra_reps` is the overage, and what the person actually did is
 * the arithmetic between them. A caller saying "ten reps at eighty" is
 * reporting performance, so this is where performance becomes columns.
 *
 * Getting it backwards is not a cosmetic bug. Writing performed reps into
 * `reps` overstates every volume figure, erases every shortfall, and makes
 * plateau detection read a stalled lift as a completed one -- and
 * exercise_logs is not rewritten afterwards to match a later understanding
 * (EZ-11, the 2026-08-29 snap, EZ-42). What goes in is what stays.
 *
 * One database rule constrains the output: failed_reps and extra_reps cannot
 * both be non-zero. A set is short or it is beaten; it is not both.
 */

export interface SetPlanInput {
  /** Reps actually performed, as reported. Zero means the set did not happen. */
  performed: number;
  /**
   * The target for this set, from the template or the exercise default.
   * Null when nothing prescribes it -- an exercise added mid-session, say --
   * in which case what was done becomes the prescription.
   */
  prescribed?: number | null;
}

export interface SetPlan {
  /** exercise_logs.reps -- the prescription. */
  reps: number;
  /** Shortfall against the prescription. 0 means recorded as none. */
  failed_reps: number;
  /** Reps beyond the prescription. 0 means recorded as none. */
  extra_reps: number;
  /**
   * Whether this counts as a set that happened. A set of zero reps is not a
   * failed set with a big shortfall, it is the absence of a set, and every
   * aggregate that conflates the two is wrong by about half.
   */
  completed: boolean;
}

export function planSet({ performed, prescribed }: SetPlanInput): SetPlan {
  if (!Number.isInteger(performed) || performed < 0) {
    throw new Error(`Reps performed must be a whole number of 0 or more (got ${performed})`);
  }
  if (prescribed != null && (!Number.isInteger(prescribed) || prescribed < 0)) {
    throw new Error(`Prescribed reps must be a whole number of 0 or more (got ${prescribed})`);
  }

  // Nothing prescribed it, so what was done is the prescription. Recording a
  // shortfall against a target nobody set would invent a failure.
  const target = prescribed != null && prescribed > 0 ? prescribed : performed;

  const failed = Math.max(target - performed, 0);
  const extra = Math.max(performed - target, 0);

  return {
    reps: target,
    failed_reps: failed,
    extra_reps: extra,
    completed: performed > 0,
  };
}

/** The inverse, for reading a row back. Mirrors stopReason.performedReps. */
export function performedFrom(row: {
  reps: number | null;
  failed_reps?: number | null;
  extra_reps?: number | null;
}): number {
  const prescribed = row.reps ?? 0;
  const failed = row.failed_reps ?? 0;
  const extra = row.extra_reps ?? 0;
  return Math.max(prescribed - failed, 0) + Math.max(extra, 0);
}
