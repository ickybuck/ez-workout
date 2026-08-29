/**
 * Detecting a lift that was never asked to do more.
 *
 * The squat sat at 275 lb for fourteen consecutive sessions with almost no
 * failed reps. Every set completed, every time. The app could see that, and had
 * no way to tell it apart from a lift at its ceiling — so it said nothing for
 * six months.
 *
 * That is not a plateau, and it matters that the two are kept apart because the
 * correct responses are opposites. A plateau is failure to improve *under
 * effort*, and the intervention is to back off: deload, reset, rebuild. A clean
 * stall is the absence of a demand, and the intervention is to add weight.
 * Running the plateau pathway on a clean stall would deload a lift that was
 * never being challenged.
 *
 *   plateau     tried to improve and could not     → reduce, then rebuild
 *   clean stall never tried                        → add load
 *
 * Two grades of evidence, and the difference is worth keeping visible:
 *
 *   **Measured.** Reps were carried past the target, or the last set was logged
 *   at 3+ reps in reserve. The athlete demonstrated headroom.
 *
 *   **Inferred.** Every set completed with nothing missed, and no headroom was
 *   recorded either way. Consistent with a load that is too light, and also
 *   consistent with one that is exactly right and simply being logged tersely.
 *
 * The distinction is not decoration. Seventeen months of history carry no
 * overage and no RIR, because neither column existed, so every stall in the
 * back catalogue is inferred by construction. Presenting those with the same
 * confidence as a set someone actually logged three reps past would be reading
 * silence as evidence.
 */

import {
  classifySet,
  extraReps,
  performedReps,
  prescribedReps,
  type SetLike,
} from './stopReason';

/** One occurrence of an exercise: its sets from a single session. */
export interface ExerciseSession {
  /** Session date, ISO. Only used for ordering and reporting. */
  date: string;
  /** The heaviest load used, in storage units. */
  topSetWeight: number;
  sets: SetLike[];
}

export type StallEvidence = 'measured' | 'inferred';

export interface CleanStall {
  /** How many consecutive qualifying sessions, ending with the most recent. */
  sessions: number;
  /** The load that has not moved. */
  weight: number;
  /** Reps carried past target across the run. Zero for an inferred stall. */
  extraReps: number;
  evidence: StallEvidence;
  since: string;
}

/**
 * Sessions must agree on load. Comparing floats directly would miss a stall
 * across a unit round-trip, where 275 lb stored as kilograms can differ in the
 * last bits between two writes.
 */
const SAME_WEIGHT_TOLERANCE_KG = 0.01;

/** Three occurrences before saying anything, so one easy day is not a verdict. */
export const MIN_SESSIONS = 3;

/**
 * Below this the exercise carries no external load, and the advice would be
 * nonsense: "0 lb for 4 sessions, time to try more?" on hanging leg raises.
 *
 * Caught by looking at the running app, not by the tests — the query used to
 * sanity-check the detector filtered `weight > 0`, so the one case that breaks
 * it was excluded from the evidence before it could be seen.
 *
 * Bodyweight work does progress, by reps rather than load, but that is a
 * different suggestion with a different threshold, and the movements it applies
 * to here are the conditioning block the research says not to chase. Silence is
 * the honest output until there is something specific to say.
 */
const MIN_LOADED_KG = 0.5;

function sameWeight(a: number, b: number): boolean {
  return Math.abs(a - b) < SAME_WEIGHT_TOLERANCE_KG;
}

/**
 * Whether a session was completed without being troubled.
 *
 * Every prescribed set present and finished, nothing missed. A skipped set
 * disqualifies the session rather than counting as clean — an exercise nobody
 * performed is not evidence the weight was light.
 */
function isCleanSession(session: ExerciseSession): boolean {
  if (session.sets.length === 0) return false;

  return session.sets.every((set) => {
    const outcome = classifySet(set);
    if (outcome === 'skipped' || outcome === 'partial') return false;
    return performedReps(set) >= prescribedReps(set);
  });
}

/** Reps past target, plus whether anyone recorded having more left. */
function sessionHeadroom(session: ExerciseSession): { extra: number; declaredReserve: boolean } {
  const extra = session.sets.reduce((total, set) => total + extraReps(set), 0);
  const declaredReserve = session.sets.some((set) => set.set_rir === '3plus');
  return { extra, declaredReserve };
}

/**
 * Find a clean stall in an exercise's recent history.
 *
 * `sessions` is newest first, which is the order every query in this app
 * returns. Returns null when the most recent session was not clean — a stall
 * has to be current to be worth acting on, and a lift that failed last time is
 * asking a different question.
 */
export function detectCleanStall(sessions: ExerciseSession[]): CleanStall | null {
  if (sessions.length < MIN_SESSIONS) return null;

  const latest = sessions[0];
  if (latest.topSetWeight < MIN_LOADED_KG) return null;
  if (!isCleanSession(latest)) return null;

  let count = 0;
  let extra = 0;
  let measured = false;
  let since = latest.date;

  for (const session of sessions) {
    if (!sameWeight(session.topSetWeight, latest.topSetWeight)) break;
    if (!isCleanSession(session)) break;

    const headroom = sessionHeadroom(session);
    count++;
    extra += headroom.extra;
    measured = measured || headroom.extra > 0 || headroom.declaredReserve;
    since = session.date;
  }

  if (count < MIN_SESSIONS) return null;

  return {
    sessions: count,
    weight: latest.topSetWeight,
    extraReps: extra,
    evidence: measured ? 'measured' : 'inferred',
    since,
  };
}

/**
 * What to say about it.
 *
 * Deliberately different wording for the two grades. The measured case can
 * state what happened; the inferred case has to be a question, because all it
 * really knows is that nothing was ever recorded as difficult — which is what
 * a well-judged load looks like too.
 */
export function describeCleanStall(stall: CleanStall, formatWeight: (kg: number) => string): string {
  const load = formatWeight(stall.weight);

  if (stall.evidence === 'measured') {
    return `${load} for ${stall.sessions} sessions, ${stall.extraReps} reps past target. Ready to go up.`;
  }

  return `${load} for ${stall.sessions} sessions, every set completed. Time to try more?`;
}
