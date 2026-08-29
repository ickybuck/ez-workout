/**
 * Estimated one-rep max — the strength series, kept apart from volume.
 *
 * Volume load answers "did I do a lot". It rises when you add a set, and it
 * conflates a heavy triple with a light twenty. Estimated 1RM answers "am I
 * stronger", because strength responds to the heaviest loads lifted rather
 * than to accumulated work. They are different questions and this codebase has
 * already been burned once by treating them as one: reading session volume put
 * Push Upper at "+14% and flat" while every press in it sat at a lifetime best.
 *
 * ## Which formula, and where it stops
 *
 * Epley and Brzycki are the two best-validated formulas for a trained
 * population and agree closely at low reps. Both degrade as reps climb, because
 * fatigue and technique variance grow faster than the linear term they assume.
 *
 *   ≤ 10 reps   Epley alone. Well validated here.
 *   11–15 reps  The mean of Epley and Brzycki, flagged low confidence. Where
 *               two reasonable formulas start to disagree, the disagreement is
 *               the honest signal, not a reason to pick a favourite.
 *   > 15 reps   Nothing. Not a number with a caveat — no number.
 *
 * That last rule costs almost nothing here: 27% of this athlete's sets are at
 * 16+ reps and nearly all carry zero load, so an estimate would have been
 * meaningless anyway.
 *
 * ## Displayed rounded, deliberately
 *
 * To the nearest 2.5 lb, or 1 kg. The formulas are estimates from a single
 * set; showing a tenth of a pound would imply a precision that neither the
 * arithmetic nor the underlying evidence has. This is the same rule that made
 * the stall banner read 275 rather than 275.14.
 */

import { classifySet, performedReps, type SetLike } from './stopReason';
import { fromKg, toKg, type WeightUnit } from './weight';

/** Above this, no estimate is offered at all. */
export const MAX_REPS_FOR_ESTIMATE = 15;

/** Up to here Epley is used alone; beyond it the two formulas are averaged. */
export const HIGH_CONFIDENCE_REPS = 10;

export type Confidence = 'high' | 'low';

export interface OneRepMax {
  /** In storage units (kg). */
  value: number;
  confidence: Confidence;
  /** The set it came from, for showing the work. */
  weight: number;
  reps: number;
}

/** 1RM = w × (1 + r/30). */
export function epley(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

/** 1RM = w / (1.0278 − 0.0278r). */
export function brzycki(weight: number, reps: number): number {
  const denominator = 1.0278 - 0.0278 * reps;
  // The denominator collapses toward zero around 37 reps and goes negative
  // beyond it. Unreachable given the rep ceiling above, but a formula that can
  // return a negative maximum should not be left able to.
  if (denominator <= 0.1) return Number.NaN;
  return weight / denominator;
}

/**
 * Estimate from a single set, or null when no honest estimate exists.
 *
 * Returns null for unloaded work, for a set that was cut short — the reps that
 * were not performed are not evidence of anything — and above the rep ceiling.
 */
export function estimateOneRepMax(set: SetLike & { weight: number | null }): OneRepMax | null {
  const weight = set.weight ?? 0;
  if (weight <= 0) return null;

  const outcome = classifySet(set);
  if (outcome === 'skipped' || outcome === 'partial') return null;

  const reps = performedReps(set);
  if (reps < 1 || reps > MAX_REPS_FOR_ESTIMATE) return null;

  // A single rep IS the maximum; no formula needed, and both would return it.
  if (reps === 1) return { value: weight, confidence: 'high', weight, reps };

  if (reps <= HIGH_CONFIDENCE_REPS) {
    return { value: epley(weight, reps), confidence: 'high', weight, reps };
  }

  const b = brzycki(weight, reps);
  if (!Number.isFinite(b)) return null;

  return { value: (epley(weight, reps) + b) / 2, confidence: 'low', weight, reps };
}

/**
 * The best estimate from a session's sets.
 *
 * A high-confidence estimate always beats a low-confidence one, even when the
 * low-confidence number is larger. Letting a 14-rep set outrank a clean 8-rep
 * set would be preferring the guess because it flattered.
 */
export function bestOneRepMax(sets: Array<SetLike & { weight: number | null }>): OneRepMax | null {
  let best: OneRepMax | null = null;

  for (const set of sets) {
    const estimate = estimateOneRepMax(set);
    if (!estimate) continue;

    if (!best) {
      best = estimate;
      continue;
    }

    const beatsOnConfidence = best.confidence === 'low' && estimate.confidence === 'high';
    const sameConfidenceButHigher =
      best.confidence === estimate.confidence && estimate.value > best.value;

    if (beatsOnConfidence || sameConfidenceButHigher) best = estimate;
  }

  return best;
}

/**
 * Round for display: 2.5 lb, or 1 kg.
 *
 * Takes and returns the display unit rather than kilograms, because rounding
 * has to happen in the unit the reader sees or it does not look round.
 */
export function roundForDisplay(kg: number, unit: WeightUnit): number {
  const grain = unit === 'lb' ? 2.5 : 1;
  return Math.round(fromKg(kg, unit) / grain) * grain;
}

export function formatOneRepMax(estimate: OneRepMax, unit: WeightUnit): string {
  const rounded = roundForDisplay(estimate.value, unit);
  const suffix = estimate.confidence === 'low' ? ' (rough)' : '';
  return `${rounded} ${unit}${suffix}`;
}

/** Convert a display-unit estimate back to storage, for comparisons. */
export function displayToStorage(value: number, unit: WeightUnit): number {
  return toKg(value, unit);
}

export interface TrendPoint {
  date: string;
  estimate: OneRepMax;
}

/**
 * Whether there is enough here to draw a trend.
 *
 * Four points across at least three weeks, from the presentation rule. Test
 * retest variation on a 1RM is around 4% under controlled conditions and worse
 * in a gym, so two sessions a week apart can differ by more than any real
 * change — and a line through two noisy points is a story, not a finding.
 */
export const MIN_TREND_POINTS = 4;
export const MIN_TREND_DAYS = 21;

export function canShowTrend(points: TrendPoint[]): boolean {
  if (points.length < MIN_TREND_POINTS) return false;

  const dates = points.map((p) => new Date(p.date).getTime()).sort((a, b) => a - b);
  const spanDays = (dates[dates.length - 1] - dates[0]) / (24 * 60 * 60 * 1000);

  return spanDays >= MIN_TREND_DAYS;
}

/**
 * Percentage change across the series, or null when it should not be shown.
 *
 * Deliberately refuses rather than returning a number the caller might display
 * anyway. The threshold is not decoration: it is what stops a normal bad day
 * being reported as a decline.
 */
export function trendPercent(points: TrendPoint[]): number | null {
  if (!canShowTrend(points)) return null;

  const ordered = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const first = ordered[0].estimate.value;
  const last = ordered[ordered.length - 1].estimate.value;

  if (first <= 0) return null;
  return ((last - first) / first) * 100;
}
