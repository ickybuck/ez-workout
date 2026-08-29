import { describe, it, expect } from 'vitest';
import { convert, parseInput, format, toKg, fromKg } from './weight';

/**
 * The cases that matter here are round-trips, not conversions in isolation.
 * A weight is entered in the user's unit, stored as kilograms, and read back
 * in the user's unit — and it is that whole path which was losing values.
 */
const roundTrip = (input: string, unit: 'kg' | 'lb') =>
  format(parseInput(input, unit), unit, { includeUnit: false });

describe('round-tripping through kilogram storage', () => {
  describe('pounds', () => {
    // EZ-11. 2.5 lb -> 1.134 kg, rounded to 1 decimal -> 1.1 kg, back to
    // 2.425 lb, rounded to a whole number -> "2". The smallest plate on the
    // bar silently became a different weight every time it was saved.
    it('keeps a 2.5 lb increment', () => {
      expect(roundTrip('2.5', 'lb')).toBe('2.5');
    });

    it.each(['1.25', '2.5', '5', '7.5', '10', '25', '35', '45', '135', '225', '315'])(
      'keeps %s lb',
      (value) => {
        expect(roundTrip(value, 'lb')).toBe(value);
      },
    );
  });

  describe('kilograms', () => {
    // The same defect in the other unit: 1.25 kg is a real plate and is in
    // the default available_plates_kg, but 1-decimal storage turned it to 1.3.
    it('keeps a 1.25 kg plate', () => {
      expect(roundTrip('1.25', 'kg')).toBe('1.25');
    });

    it.each(['1.25', '2.5', '5', '10', '15', '20', '25', '60', '100', '142.5'])(
      'keeps %s kg',
      (value) => {
        expect(roundTrip(value, 'kg')).toBe(value);
      },
    );
  });
});

describe('format', () => {
  it('trims trailing zeros so whole numbers read cleanly', () => {
    expect(format(20, 'kg')).toBe('20 kg');
  });

  it('keeps significant decimals', () => {
    expect(format(1.25, 'kg')).toBe('1.25 kg');
  });

  it('can omit the unit', () => {
    expect(format(20, 'kg', { includeUnit: false })).toBe('20');
  });

  it('does not leak binary floating point noise', () => {
    // 20.41 kg -> 45.0003... lb. Naive conversion prints a long tail.
    expect(format(20.41, 'lb')).toBe('45 lb');
  });
});

describe('convert', () => {
  it('is a no-op between identical units', () => {
    expect(convert(42.5, 'kg', 'kg')).toBe(42.5);
    expect(convert(42.5, 'lb', 'lb')).toBe(42.5);
  });

  it('converts kg to lb', () => {
    expect(convert(100, 'kg', 'lb')).toBeCloseTo(220.46, 2);
  });

  it('converts lb to kg', () => {
    expect(convert(45, 'lb', 'kg')).toBeCloseTo(20.41, 2);
  });

  it('survives a conversion there and back', () => {
    expect(convert(convert(100, 'kg', 'lb'), 'lb', 'kg')).toBeCloseTo(100, 1);
  });
});

describe('parseInput', () => {
  it('returns 0 for unparseable input rather than NaN', () => {
    // The forms depend on this: they pass the raw field value straight in.
    expect(parseInput('', 'kg')).toBe(0);
    expect(parseInput('abc', 'kg')).toBe(0);
  });

  it('stores at three decimals, matching the numeric(10,3) columns', () => {
    // More precision than the column holds would be truncated by Postgres
    // anyway, and pretending otherwise is how round-trips drift.
    expect(parseInput('1.1264', 'kg')).toBe(1.126);
  });

  it('tolerates surrounding whitespace and units typed by hand', () => {
    expect(parseInput(' 20 ', 'kg')).toBe(20);
  });
});

describe('toKg / fromKg are exact inverses before rounding', () => {
  it.each([1.25, 2.5, 45, 135, 315])('for %s lb', (value) => {
    expect(fromKg(toKg(value, 'lb'), 'lb')).toBeCloseTo(value, 10);
  });
});
