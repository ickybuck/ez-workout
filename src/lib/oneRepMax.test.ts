import { describe, it, expect } from 'vitest';
import {
  epley,
  brzycki,
  estimateOneRepMax,
  bestOneRepMax,
  roundForDisplay,
  formatOneRepMax,
  canShowTrend,
  trendPercent,
  MAX_REPS_FOR_ESTIMATE,
  type TrendPoint,
} from './oneRepMax';
import { toKg } from './weight';

const set = (over: Partial<Parameters<typeof estimateOneRepMax>[0]> = {}) => ({
  reps: 10,
  failed_reps: 0,
  weight: 100,
  ...over,
});

describe('the formulas', () => {
  it('computes Epley', () => {
    // 100 × (1 + 10/30) = 133.33
    expect(epley(100, 10)).toBeCloseTo(133.333, 3);
  });

  it('computes Brzycki', () => {
    // 100 / (1.0278 - 0.278) = 133.37
    expect(brzycki(100, 10)).toBeCloseTo(133.369, 3);
  });

  it('agrees closely at low reps, which is why either is defensible there', () => {
    // Compared as a percentage, not an absolute: the gap scales with the load,
    // so an absolute threshold would pass for a light lift and fail for a heavy
    // one while saying nothing about agreement.
    for (const reps of [3, 5, 8, 10]) {
      const gap = Math.abs(epley(100, reps) - brzycki(100, reps));
      expect(gap / epley(100, reps)).toBeLessThan(0.05);
    }
  });

  it('diverges as reps climb, which is why they get averaged and flagged', () => {
    expect(Math.abs(epley(100, 15) - brzycki(100, 15))).toBeGreaterThan(6);
  });

  it('refuses to return a negative maximum', () => {
    // Brzycki's denominator collapses toward zero near 37 reps. Unreachable
    // given the rep ceiling, but a formula able to return a negative maximum
    // should not be left able to.
    expect(Number.isNaN(brzycki(100, 40))).toBe(true);
  });
});

describe('estimating from a set', () => {
  it('uses Epley alone up to ten reps, at high confidence', () => {
    const estimate = estimateOneRepMax(set({ reps: 8 }));
    expect(estimate?.confidence).toBe('high');
    expect(estimate?.value).toBeCloseTo(epley(100, 8), 6);
  });

  it('averages both formulas at eleven to fifteen, flagged low confidence', () => {
    const estimate = estimateOneRepMax(set({ reps: 12 }));
    expect(estimate?.confidence).toBe('low');
    expect(estimate?.value).toBeCloseTo((epley(100, 12) + brzycki(100, 12)) / 2, 6);
  });

  it('gives no estimate at all above fifteen reps', () => {
    // Not a number with a caveat. No number.
    expect(estimateOneRepMax(set({ reps: MAX_REPS_FOR_ESTIMATE + 1 }))).toBeNull();
    expect(estimateOneRepMax(set({ reps: 45 }))).toBeNull();
  });

  it('returns the weight itself for a single rep', () => {
    const estimate = estimateOneRepMax(set({ reps: 1 }));
    expect(estimate?.value).toBe(100);
    expect(estimate?.confidence).toBe('high');
  });

  it('gives nothing for unloaded work', () => {
    expect(estimateOneRepMax(set({ weight: 0 }))).toBeNull();
    expect(estimateOneRepMax(set({ weight: null }))).toBeNull();
  });

  it('gives nothing for a set that was cut short', () => {
    // The reps that were not performed are not evidence of anything.
    expect(estimateOneRepMax(set({ failed_reps: 3 }))).toBeNull();
  });

  it('gives nothing for a skipped set', () => {
    expect(estimateOneRepMax(set({ failed_reps: 10 }))).toBeNull();
  });

  it('counts a set carried past its target at the reps actually performed', () => {
    const estimate = estimateOneRepMax(set({ reps: 8, extra_reps: 2 }));
    expect(estimate?.reps).toBe(10);
    expect(estimate?.value).toBeCloseTo(epley(100, 10), 6);
  });
});

describe('picking the best estimate from a session', () => {
  it('takes the highest when confidence is equal', () => {
    const best = bestOneRepMax([set({ weight: 100, reps: 5 }), set({ weight: 110, reps: 5 })]);
    expect(best?.weight).toBe(110);
  });

  it('prefers a confident estimate over a larger rough one', () => {
    // A 14-rep set can produce a bigger number than a clean 8-rep set.
    // Preferring it would be choosing the guess because it flattered.
    const rough = set({ weight: 100, reps: 14 });
    const solid = set({ weight: 100, reps: 8 });
    expect(estimateOneRepMax(rough)!.value).toBeGreaterThan(estimateOneRepMax(solid)!.value);

    const best = bestOneRepMax([rough, solid]);
    expect(best?.confidence).toBe('high');
    expect(best?.reps).toBe(8);
  });

  it('returns null when no set qualifies', () => {
    expect(bestOneRepMax([set({ weight: 0 }), set({ reps: 30 })])).toBeNull();
    expect(bestOneRepMax([])).toBeNull();
  });
});

describe('display rounding', () => {
  it('rounds to the nearest 2.5 lb', () => {
    expect(roundForDisplay(toKg(276.9, 'lb'), 'lb')).toBe(277.5);
    expect(roundForDisplay(toKg(275.4, 'lb'), 'lb')).toBe(275);
  });

  it('rounds to the nearest kilo for metric', () => {
    expect(roundForDisplay(100.4, 'kg')).toBe(100);
  });

  it('marks a rough estimate as rough', () => {
    const rough = estimateOneRepMax(set({ reps: 13 }))!;
    expect(formatOneRepMax(rough, 'kg')).toContain('(rough)');
  });

  it('does not caveat a confident one', () => {
    const solid = estimateOneRepMax(set({ reps: 5 }))!;
    expect(formatOneRepMax(solid, 'kg')).not.toContain('rough');
  });
});

describe('refusing to draw a trend too early', () => {
  const point = (date: string, weight: number): TrendPoint => ({
    date,
    estimate: estimateOneRepMax(set({ weight, reps: 5 }))!,
  });

  it('needs four points', () => {
    expect(
      canShowTrend([point('2026-01-01', 100), point('2026-02-01', 105), point('2026-03-01', 110)]),
    ).toBe(false);
  });

  it('needs three weeks, however many points', () => {
    // Four sessions in one week is not three weeks of evidence.
    expect(
      canShowTrend([
        point('2026-01-01', 100),
        point('2026-01-02', 102),
        point('2026-01-03', 104),
        point('2026-01-04', 106),
      ]),
    ).toBe(false);
  });

  it('accepts four points across three weeks', () => {
    const points = [
      point('2026-01-01', 100),
      point('2026-01-08', 102),
      point('2026-01-15', 104),
      point('2026-01-25', 110),
    ];
    expect(canShowTrend(points)).toBe(true);
    expect(trendPercent(points)).toBeCloseTo(10, 6);
  });

  it('returns null rather than a number a caller might show anyway', () => {
    // The threshold is what stops a normal bad day being reported as a decline.
    expect(trendPercent([point('2026-01-01', 100), point('2026-02-01', 90)])).toBeNull();
  });

  it('reads the series in date order regardless of input order', () => {
    const points = [
      point('2026-01-25', 110),
      point('2026-01-01', 100),
      point('2026-01-15', 104),
      point('2026-01-08', 102),
    ];
    expect(trendPercent(points)).toBeCloseTo(10, 6);
  });
});
