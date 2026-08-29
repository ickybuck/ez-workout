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
