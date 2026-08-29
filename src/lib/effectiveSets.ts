/**
 * Counting training in hard sets rather than reps.
 *
 * The programme's weekly target has always been expressed in reps per muscle.
 * The entire dose-response literature is expressed in *sets* per muscle, and
 * the two are not interchangeable — a hard set delivers most of its stimulus in
 * the reps near failure, largely regardless of whether it was five reps or
 * thirty. Twenty unloaded core reps and ten heavy squat reps are not two to
 * one; they may be roughly equal, or the heavy set may deliver more.
 *
 * For this athlete the distortion is not theoretical. 27% of his sets are at
 * 16+ reps and almost all of those carry zero external load, so a rep-weighted
 * target systematically inflates exactly the work that is unloaded,
 * discretionary and routinely skipped. That is why the muscle ranking put
 * Abdominals at 33.4 a week and Chest at 9.6.
 *
 * ## What counts
 *
 * A set contributes 1.0 to each muscle it primarily works and 0.5 to each
 * muscle it works secondarily — the fractional method, which carried the
 * strongest relative evidence in the dose-response work.
 *
 * It contributes nothing at all if:
 *
 *   - it carries no external load. Light ballistic movement delivers little
 *     mechanical tension to any single muscle, and mechanical tension is the
 *     driver. These are counted separately as conditioning, not discarded.
 *   - it was skipped, or less than half the prescribed reps were performed.
 *     Half a set is not a hard set.
 *
 * ## The effort factor, and why it is not three tiers
 *
 * The research prescribes 1.0 at RIR ≤ 5, 0.5 at RIR 6–8, and 0 above that.
 * That cannot be implemented as written here, and pretending otherwise would
 * be worse than saying so: the app records RIR as one of three bands — 0, 1-2,
 * 3plus — and **every one of them is within the ≤ 5 range**. The tiers that
 * would reduce a set's contribution need values the app has no way to express.
 *
 * So the factor collapses honestly to loaded-or-not. If a finer RIR scale is
 * ever collected, this is the one function to change.
 *
 * ## Performed, never prescribed
 *
 * Every figure here is what was actually done. Prescribed volume is a plan;
 * performed volume is the stimulus, and for this athlete they diverge
 * systematically on exactly one muscle group because he cuts abdominal work to
 * save effort for legs. Reporting the plan would show a problem he does not
 * have and hide the one he does.
 */

import { classifySet, performedReps, prescribedReps, type SetLike } from './stopReason';

/** Below this an exercise carries no external load worth counting. */
const MIN_LOADED_KG = 0.5;

/** Less than half the prescribed reps is not a hard set. */
const MIN_COMPLETION = 0.5;

export const PRIMARY_WEIGHT = 1.0;
export const SECONDARY_WEIGHT = 0.5;

/**
 * Weekly per-muscle bands, from the dose-response meta-regression.
 *
 * Presented as observation rather than instruction. The underlying evidence
 * supports a broad productive zone with a logarithmic response and real
 * individual variation; it does not validate these numbers as constants.
 */
export const WEEKLY_TARGET = { min: 10, max: 20, underserved: 8, high: 30 } as const;

/** The per-session ceiling beyond which more sets for one muscle stop paying. */
export const PER_SESSION_CEILING = 11;

export interface MuscleRef {
  name: string;
  isPrimary: boolean;
}

export interface CountableSet extends SetLike {
  weight: number | null;
  /** The muscles this set's exercise works. Empty means unmapped, not unused. */
  muscles: MuscleRef[];
  /** For reporting which exercises are missing a mapping. */
  exerciseName: string;
}

export interface MuscleTally {
  muscle: string;
  effectiveSets: number;
  verdict: 'under-served' | 'in range' | 'high';
}

export interface EffectiveSetSummary {
  perMuscle: MuscleTally[];
  /** Sets excluded for carrying no load, kept visible rather than dropped. */
  conditioningSets: number;
  /** Sets excluded for being skipped or barely started. */
  incompleteSets: number;
  /**
   * Exercises with no muscle mapping, and how many of their sets went nowhere.
   *
   * Surfaced rather than silently dropped. Seated Cable Rows and Leg Press had
   * no mapping at all — 216 sets contributing to nothing — and it went unnoticed
   * for seventeen months because nothing read the mapping closely enough to
   * miss them.
   */
  unmapped: Array<{ exerciseName: string; sets: number }>;
}

/**
 * Whether this set counts toward hypertrophy volume at all.
 *
 * Unloaded and incomplete sets are excluded for different reasons and reported
 * separately, because "you did conditioning" and "you cut this short" are
 * different facts about a session.
 */
export function setContribution(set: CountableSet): 'counts' | 'conditioning' | 'incomplete' {
  const outcome = classifySet(set);
  if (outcome === 'skipped') return 'incomplete';

  const prescribed = prescribedReps(set);
  if (prescribed > 0 && performedReps(set) / prescribed < MIN_COMPLETION) return 'incomplete';

  if ((set.weight ?? 0) < MIN_LOADED_KG) return 'conditioning';

  return 'counts';
}

function verdictFor(effectiveSets: number): MuscleTally['verdict'] {
  if (effectiveSets < WEEKLY_TARGET.underserved) return 'under-served';
  if (effectiveSets > WEEKLY_TARGET.high) return 'high';
  return 'in range';
}

/**
 * Tally effective sets per muscle.
 *
 * `weeks` scales the total to a weekly rate. Passing the real elapsed span
 * rather than assuming one week matters here: attendance is 2.0–2.4 sessions a
 * week against a target of 4, so a figure computed as though every week were
 * full would overstate everything by roughly half.
 */
export function summariseEffectiveSets(sets: CountableSet[], weeks = 1): EffectiveSetSummary {
  const totals = new Map<string, number>();
  const unmappedCounts = new Map<string, number>();
  let conditioningSets = 0;
  let incompleteSets = 0;

  for (const set of sets) {
    const contribution = setContribution(set);

    if (contribution === 'incomplete') {
      incompleteSets++;
      continue;
    }
    if (contribution === 'conditioning') {
      conditioningSets++;
      continue;
    }

    if (set.muscles.length === 0) {
      unmappedCounts.set(set.exerciseName, (unmappedCounts.get(set.exerciseName) ?? 0) + 1);
      continue;
    }

    for (const muscle of set.muscles) {
      const weight = muscle.isPrimary ? PRIMARY_WEIGHT : SECONDARY_WEIGHT;
      totals.set(muscle.name, (totals.get(muscle.name) ?? 0) + weight);
    }
  }

  const divisor = weeks > 0 ? weeks : 1;

  const perMuscle = [...totals.entries()]
    .map(([muscle, total]) => {
      const effectiveSets = Math.round((total / divisor) * 10) / 10;
      return { muscle, effectiveSets, verdict: verdictFor(effectiveSets) };
    })
    .sort((a, b) => b.effectiveSets - a.effectiveSets);

  return {
    perMuscle,
    conditioningSets,
    incompleteSets,
    unmapped: [...unmappedCounts.entries()]
      .map(([exerciseName, sets]) => ({ exerciseName, sets }))
      .sort((a, b) => b.sets - a.sets),
  };
}

/**
 * Muscles carrying enough weekly volume to be worth splitting across sessions.
 *
 * Above roughly ten weekly sets the evidence favours spreading the work over
 * two or more sessions rather than concentrating it, and there is a per-session
 * ceiling around eleven beyond which more sets for one muscle stop
 * contributing. The current templates give some muscles twelve or more in a
 * single session and then nothing for eleven days, which is both sides of that
 * at once.
 */
export function shouldSplitAcrossSessions(tally: MuscleTally): boolean {
  return tally.effectiveSets > WEEKLY_TARGET.min;
}
