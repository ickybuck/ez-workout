/**
 * Why a set ended.
 *
 * `failed_reps` has been carrying three unrelated meanings at once: a set cut
 * short, a set never started, and a set traded away to spend the effort
 * elsewhere. Over the last year 52.9% of all recorded failed reps came from
 * sets with zero reps performed — not failures of any kind. Every fatigue rule
 * built on that number was reasoning about the wrong thing.
 *
 * This module is the fix, and it is deliberately pure: it decides what a set
 * means, when to ask, and how to aggregate, without knowing what a database is.
 *
 * Two rules run through all of it.
 *
 * **A null is a null.** Not recorded means unknown, never inferred. The
 * seventeen months logged before this shipped have no cause and never will, so
 * cause-based analytics exclude them rather than guessing — guessing would be
 * manufacturing data, which is the failure this exists to end.
 *
 * **Depletion is two different things.** `session_depletion` (spent by the work
 * just done) and `daily_depletion` (low before arriving) look alike and call
 * for opposite responses: one says fix recovery, the other says fix readiness.
 * Merging them would recreate the conflation this module exists to end.
 */

export const STOP_REASONS = [
  'muscular_failure',
  'session_depletion',
  'daily_depletion',
  'deprioritised',
  'out_of_time',
  'discomfort',
] as const;

export type StopReason = (typeof STOP_REASONS)[number];

export const RIR_BANDS = ['0', '1-2', '3plus'] as const;
export type RirBand = (typeof RIR_BANDS)[number];

/**
 * The date the columns shipped. Sets logged before this cannot carry a cause,
 * which is different from a user declining to answer — both are unknown, but
 * only one could ever have been known, and coverage stats need to tell them
 * apart.
 */
export const INSTRUMENTATION_START = '2026-08-29';

interface ReasonMeta {
  /** Shown on the chip. Short enough to tap between sets. */
  label: string;
  /** One line of plain speech, for the first time it is seen. */
  meaning: string;
  /**
   * Whether this reason may influence load prescription.
   *
   * Only muscular failure may. A set cut for time says nothing about whether
   * the weight was right, and treating it as if it did is how a ratchet ends
   * up adding weight on top of a bad night's sleep.
   */
  feedsLoadPrescription: boolean;
  /**
   * Whether this counts as a training signal at all. `out_of_time` does not —
   * it is the calendar, not the athlete, and it should never reach a fatigue
   * or adherence metric.
   */
  isTrainingSignal: boolean;
}

export const STOP_REASON_META: Record<StopReason, ReasonMeta> = {
  muscular_failure: {
    label: 'Muscle failed',
    meaning: 'The muscle could not complete the rep.',
    feedsLoadPrescription: true,
    isTrainingSignal: true,
  },
  session_depletion: {
    label: 'Out of gas',
    meaning: 'Spent by the work already done in this session.',
    feedsLoadPrescription: false,
    isTrainingSignal: true,
  },
  daily_depletion: {
    label: 'Low energy today',
    meaning: 'Arrived low — sleep, illness, stress, diet.',
    feedsLoadPrescription: false,
    isTrainingSignal: true,
  },
  deprioritised: {
    label: 'Skipped on purpose',
    meaning: 'Chose to spend the remaining effort elsewhere.',
    feedsLoadPrescription: false,
    isTrainingSignal: true,
  },
  out_of_time: {
    label: 'Ran out of time',
    meaning: 'The schedule ended it, not the training.',
    feedsLoadPrescription: false,
    isTrainingSignal: false,
  },
  discomfort: {
    label: 'Pain or discomfort',
    meaning: 'A joint or other pain stopped the set.',
    feedsLoadPrescription: false,
    isTrainingSignal: true,
  },
};

export function isStopReason(value: unknown): value is StopReason {
  return typeof value === 'string' && (STOP_REASONS as readonly string[]).includes(value);
}

export function isRirBand(value: unknown): value is RirBand {
  return typeof value === 'string' && (RIR_BANDS as readonly string[]).includes(value);
}

/** The shape this module needs from a logged set. */
export interface SetLike {
  /** Prescribed reps. The column is named `reps`, which reads as performed and is not. */
  reps: number | null;
  failed_reps: number | null;
  /** Reps performed beyond the target. Mutually exclusive with failed_reps. */
  extra_reps?: number | null;
  stop_reason?: string | null;
  set_rir?: string | null;
}

export type SetOutcome = 'complete' | 'partial' | 'skipped' | 'exceeded';

/**
 * Reps actually performed.
 *
 * Worth stating in one place because the column names invite the opposite
 * reading: `reps` is the prescription and `failed_reps` is the shortfall, so
 * performed is the difference. Reading `reps` as performed overstates every
 * volume and understates every failure.
 */
export function performedReps(set: SetLike): number {
  const prescribed = set.reps ?? 0;
  const failed = set.failed_reps ?? 0;
  const extra = set.extra_reps ?? 0;
  return Math.max(prescribed - failed, 0) + Math.max(extra, 0);
}

/** Reps beyond the target. The measured half of double progression. */
export function extraReps(set: SetLike): number {
  return Math.max(set.extra_reps ?? 0, 0);
}

export function prescribedReps(set: SetLike): number {
  return set.reps ?? 0;
}

/**
 * What happened to this set.
 *
 * A skipped set is not a failed set with a big number. It is the absence of a
 * set, and every aggregate that treats the two alike is wrong by roughly half.
 */
export function classifySet(set: SetLike): SetOutcome {
  const prescribed = prescribedReps(set);
  if (prescribed === 0) return 'skipped';
  const performed = performedReps(set);
  if (performed === 0) return 'skipped';
  if (performed > prescribed) return 'exceeded';
  return performed < prescribed ? 'partial' : 'complete';
}

/**
 * Whether to show the reason chips.
 *
 * Only when something is already known to be off, so a normal session is
 * untouched. Thirty sets a session means a prompt on every set would be
 * abandoned within a week, and an abandoned prompt yields worse data than no
 * prompt because the gaps are not random.
 */
export function shouldPromptForReason(set: SetLike): boolean {
  const outcome = classifySet(set);
  return outcome === 'partial' || outcome === 'skipped';
}

/**
 * Whether to offer the reps-in-reserve tap.
 *
 * Only on a cleanly completed set of a loaded exercise, and callers pass
 * `isLastSet` because that is where the answer carries information — an early
 * set at 3+ RIR is the plan working, a last set at 3+ RIR is a load that never
 * asked for anything.
 *
 * Deliberately NOT offered on an exceeded set. Overage already answers the
 * question, and answers it better: reps beyond the target are counted, while
 * RIR is estimated, and the estimate is least reliable exactly where this
 * athlete trains. Asking both would be asking him to guess at something the
 * app just measured.
 *
 * Nor on a short set — that would be asking how much was left in the tank of a
 * set that ran out of road.
 */
export function shouldPromptForRir(
  set: SetLike,
  { isLastSet, isLoaded }: { isLastSet: boolean; isLoaded: boolean },
): boolean {
  return isLastSet && isLoaded && classifySet(set) === 'complete';
}

/**
 * Whether this set is evidence the load is too light.
 *
 * The measured signal, and the reason overage was worth a schema change. A set
 * carried past its target says the prescription was beatable; how far past
 * says by roughly how much. Compare with the inferred version — a clean
 * completion with no overage and no RIR — which is only evidence that nothing
 * was asked.
 */
export function suggestsLoadIncrease(set: SetLike): boolean {
  if (classifySet(set) === 'exceeded') return true;
  return classifySet(set) === 'complete' && set.set_rir === '3plus';
}

export interface SetSummary {
  sets: number;
  complete: number;
  partial: number;
  skipped: number;
  /** Sets carried past their target. Evidence the prescription is beatable. */
  exceeded: number;
  prescribedReps: number;
  performedReps: number;
  /** Reps beyond target, summed. The magnitude behind `exceeded`. */
  extraReps: number;
  /** Missed reps on sets that were actually started. The honest fatigue signal. */
  genuinePartialReps: number;
  /** Missed reps from sets never started. An adherence signal, never a fatigue one. */
  skippedReps: number;
  /** genuinePartialReps over prescribed reps on started sets. */
  genuinePartialRate: number;
  /** Skipped sets over all sets. */
  skipRate: number;
  /** How many sets carry a recorded reason, of those that should. */
  reasonsRecorded: number;
  reasonsExpected: number;
}

const EMPTY: SetSummary = {
  sets: 0,
  complete: 0,
  partial: 0,
  skipped: 0,
  exceeded: 0,
  prescribedReps: 0,
  performedReps: 0,
  extraReps: 0,
  genuinePartialReps: 0,
  skippedReps: 0,
  genuinePartialRate: 0,
  skipRate: 0,
  reasonsRecorded: 0,
  reasonsExpected: 0,
};

/**
 * Aggregate a group of sets, keeping skipped and partial separate throughout.
 *
 * `genuinePartialRate` is computed over *started* sets only. That is the whole
 * point: the raw rate put Split Squats at 18.3% and named them the one loaded
 * exercise in trouble, when the honest figure is 4.9% and the rest was
 * skipping.
 */
export function summariseSets(sets: SetLike[]): SetSummary {
  if (sets.length === 0) return EMPTY;

  const summary = { ...EMPTY, sets: sets.length };

  for (const set of sets) {
    const outcome = classifySet(set);
    const prescribed = prescribedReps(set);
    const performed = performedReps(set);
    const missed = Math.max(prescribed - performed, 0);

    summary.prescribedReps += prescribed;
    summary.performedReps += performed;
    summary.extraReps += extraReps(set);

    if (outcome === 'skipped') {
      summary.skipped++;
      summary.skippedReps += missed;
    } else if (outcome === 'partial') {
      summary.partial++;
      summary.genuinePartialReps += missed;
    } else if (outcome === 'exceeded') {
      summary.exceeded++;
    } else {
      summary.complete++;
    }

    if (shouldPromptForReason(set)) {
      summary.reasonsExpected++;
      if (isStopReason(set.stop_reason)) summary.reasonsRecorded++;
    }
  }

  const startedPrescribed = summary.prescribedReps - summary.skippedReps;
  summary.genuinePartialRate =
    startedPrescribed > 0 ? summary.genuinePartialReps / startedPrescribed : 0;
  summary.skipRate = summary.skipped / summary.sets;

  return summary;
}

/**
 * Whether a set's cause is known well enough to reason about.
 *
 * Everything cause-based must filter on this. A set logged before the columns
 * existed is not evidence of anything, and letting it default into a bucket is
 * how the last two rounds of analysis went wrong.
 */
export function hasCauseData(set: SetLike): boolean {
  return isStopReason(set.stop_reason);
}

/**
 * Only muscular failure may move a load.
 *
 * The guard that makes the ratchet safe: a session cut for time or arrived-low
 * is not evidence the weight was easy, and must not add weight on top of a
 * deficit.
 */
export function mayInformLoad(set: SetLike): boolean {
  return isStopReason(set.stop_reason) && STOP_REASON_META[set.stop_reason].feedsLoadPrescription;
}

/** Reasons that say something about training. `out_of_time` is the calendar. */
export function isTrainingSignal(reason: StopReason): boolean {
  return STOP_REASON_META[reason].isTrainingSignal;
}

/** Count of each recorded reason, for the limiter verdict. Unknowns are excluded. */
export function tallyReasons(sets: SetLike[]): Record<StopReason, number> {
  const tally = Object.fromEntries(STOP_REASONS.map((r) => [r, 0])) as Record<StopReason, number>;
  for (const set of sets) {
    if (isStopReason(set.stop_reason)) tally[set.stop_reason]++;
  }
  return tally;
}
