import { describe, it, expect } from 'vitest';
import { restDurationFor, DEFAULT_REST, DEFAULT_EXTENDED_REST } from './restTimer';

const settings = { normal: 90, extended: 120 };
const extended = new Set(['squats', 'deadlift']);

describe('restDurationFor', () => {
  it('gives the long rest to an exercise marked for it', () => {
    expect(restDurationFor(['squats'], extended, settings)).toBe(120);
  });

  it('gives the normal rest to everything else', () => {
    expect(restDurationFor(['lateral-raises'], extended, settings)).toBe(90);
  });

  it('gives the long rest to a superset containing one marked exercise', () => {
    // A superset is one rest, taken at the end of the pair. If either half
    // earns the long one, the block gets it — resting 90 seconds because the
    // marked lift happened to be listed second would be the wrong way round.
    expect(restDurationFor(['lateral-raises', 'deadlift'], extended, settings)).toBe(120);
    expect(restDurationFor(['deadlift', 'lateral-raises'], extended, settings)).toBe(120);
  });

  it('keeps the normal rest for a superset of two unmarked exercises', () => {
    expect(restDurationFor(['dips', 'pull-ups'], extended, settings)).toBe(90);
  });

  it('falls back when the block is empty, which is the state between exercises', () => {
    expect(restDurationFor([], extended, settings)).toBe(90);
  });

  it('ignores ids that are missing, which is what a half-loaded workout looks like', () => {
    expect(restDurationFor([null, undefined], extended, settings)).toBe(90);
    expect(restDurationFor([null, 'squats'], extended, settings)).toBe(120);
  });

  it('uses the built-in defaults when a setting is absent or nonsense', () => {
    // user_settings columns are nullable, and a 0-second rest timer would
    // fire instantly and look like the feature is broken rather than off.
    expect(restDurationFor(['squats'], extended, { normal: 90, extended: 0 })).toBe(
      DEFAULT_EXTENDED_REST,
    );
    expect(restDurationFor(['dips'], extended, { normal: null, extended: 120 })).toBe(DEFAULT_REST);
    expect(restDurationFor(['dips'], extended, { normal: -5, extended: 120 })).toBe(DEFAULT_REST);
  });

  it('treats an empty marked set as everything being normal', () => {
    expect(restDurationFor(['squats'], new Set(), settings)).toBe(90);
  });
});
