/**
 * Weight conversion and formatting.
 *
 * Extracted from useWeightUnit so it can be tested without React, Supabase or
 * zustand in the way. The hook still owns "which unit is the user in"; this
 * module owns the arithmetic.
 *
 * Weights are stored in kilograms as numeric(10,3) — 1 gram resolution.
 * The columns were numeric(10,2) until 2026-08-29, which is 0.022 lb and too
 * coarse for a user working in pounds: 135 lb stored as 61.23 kg reads back
 * as 134.99 lb. A round-trip test caught that; inspection had not.
 */

export type WeightUnit = 'kg' | 'lb';

export const LB_PER_KG = 2.20462262185;

/** Matches the numeric(10,3) columns weights are stored in (1 g resolution). */
export const STORAGE_DECIMALS = 3;

/**
 * Decimals kept when showing a weight. Two, trimmed, so 2.5 lb and 1.25 kg
 * survive — both are real plate increments. The previous implementation
 * rounded lb to whole numbers, which made a 2.5 lb increment display as 2.
 */
export const DISPLAY_DECIMALS = 2;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Convert a value in `from` units to kilograms, unrounded. */
export function toKg(value: number, from: WeightUnit): number {
  return from === 'kg' ? value : value / LB_PER_KG;
}

/** Convert kilograms to `to` units, unrounded. */
export function fromKg(kg: number, to: WeightUnit): number {
  return to === 'kg' ? kg : kg * LB_PER_KG;
}

/**
 * Convert between units, rounding only at the end.
 * Rounds to display resolution, not storage resolution — use parseInput for
 * anything on its way to the database.
 */
export function convert(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return round(value, DISPLAY_DECIMALS);
  return round(fromKg(toKg(value, from), to), DISPLAY_DECIMALS);
}

/**
 * The step a user is offered when nothing else says otherwise.
 *
 * Stored in kilograms like every other weight, but chosen in the unit the
 * plates are actually marked in. 2.3 kg was the old answer everywhere, picked
 * back in 2025 as "about five pounds" — and it shows in the app as 5.07 lb,
 * which is not a step anybody takes. Five pounds is 2.267962 kg; the pounds
 * user gets exactly that, and the kilogram user gets 2.5, which is what the
 * plates on that side of the Atlantic come in.
 *
 * Note this is the same number to one decimal place in kilograms — 2.3 — so
 * the kilogram display does not change. Only the pounds one stops lying.
 */
export function defaultIncrementKg(unit: WeightUnit): number {
  return unit === 'lb' ? toKg(5, 'lb') : 2.5;
}

/**
 * Snap a converted increment onto the unit's own step.
 *
 * A kilogram step is never a round number of pounds: 4.5 kg is 9.92 lb, 9.1 kg
 * is 20.06. Offering 9.92 in an editable field is both ugly and an invitation
 * to "correct" it to something slightly different, which is how the stored
 * weights drifted in the first place (EZ-11, and the 2026-08-29 snap).
 *
 * Lives here rather than in the plate calculator, which is where it used to be
 * — one screen rounding the display while every other screen showed the raw
 * conversion is how 5.07 lb stayed visible for a year.
 */
export function snapIncrement(display: number, unit: WeightUnit): number {
  const step = unit === 'lb' ? 1 : 0.5;
  return Math.max(step, Math.round(display / step) * step);
}

/**
 * Parse user input in `unit` into kilograms for storage.
 * Returns 0 for anything unparseable, matching the previous behaviour — the
 * forms rely on it rather than handling NaN themselves.
 */
export function parseInput(input: string, unit: WeightUnit): number {
  const value = parseFloat(input);
  if (Number.isNaN(value)) return 0;
  return round(toKg(value, unit), STORAGE_DECIMALS);
}

/**
 * Format a stored kilogram value for display in `unit`.
 * Trailing zeros are trimmed, so whole numbers read as "45 lb" rather than
 * "45.00 lb" while 2.5 and 1.25 keep the precision that makes them useful.
 */
export function format(
  kg: number,
  unit: WeightUnit,
  { includeUnit = true }: { includeUnit?: boolean } = {},
): string {
  const converted = round(fromKg(kg, unit), DISPLAY_DECIMALS);
  // toFixed then strip trailing zeros: avoids 45.000000000000004 from binary
  // floating point while still printing 2.5 as "2.5" rather than "2.50".
  const text = converted
    .toFixed(DISPLAY_DECIMALS)
    .replace(/\.?0+$/, '');
  return includeUnit ? `${text} ${unit}` : text;
}

/**
 * Format an aggregate volume (weight x reps summed over a workout).
 *
 * Deliberately different from `format`: volumes run to five or six figures,
 * where the decimals `format` keeps are noise rather than precision. A single
 * plate needs to read "2.5 lb"; a session total does not need to read
 * "50082.85 lb". Grouping separators earn their place at this magnitude too.
 */
export function formatVolume(
  kg: number,
  unit: WeightUnit,
  { includeUnit = true }: { includeUnit?: boolean } = {},
): string {
  const text = Math.round(fromKg(kg, unit)).toLocaleString();
  return includeUnit ? `${text} ${unit}` : text;
}
