import { describe, it, expect } from 'vitest';
import { normaliseName } from './templateBundleImport';

describe('normaliseName', () => {
  it('matches the same movement spelled two ways', () => {
    expect(normaliseName('Push-Ups')).toBe(normaliseName('Push Ups'));
    expect(normaliseName('Bench press')).toBe(normaliseName('Bench Press'));
    expect(normaliseName('T-Bar Rows')).toBe(normaliseName('T Bar Rows'));
  });

  it('does NOT match exercises that merely share words', () => {
    // The failure that matters. Collapsing "Incline Bench Press" onto
    // "Bench Press" would silently log the wrong exercise, which is worse
    // than asking the user to resolve it.
    expect(normaliseName('Incline Bench Press')).not.toBe(normaliseName('Bench Press'));
    expect(normaliseName('Seated Calf Raises')).not.toBe(normaliseName('Standing Calf Raises'));
    expect(normaliseName('Hammer Curls')).not.toBe(normaliseName('Bicep Curls'));
  });

  it('is stable for names that need no normalising', () => {
    expect(normaliseName('Deadlift')).toBe('deadlift');
  });

  it('survives punctuation a model might add', () => {
    expect(normaliseName('  Face  Pulls  ')).toBe(normaliseName('Face Pulls'));
    expect(normaliseName('Squats (Barbell)')).toBe(normaliseName('Squats Barbell'));
  });
});
