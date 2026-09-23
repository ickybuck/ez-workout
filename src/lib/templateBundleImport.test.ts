import { describe, it, expect, vi } from 'vitest';
import type { BundleTemplate } from './templateBundle';

// This module reaches Supabase, and supabase.ts throws at import time when the
// environment has no keys — which is every CI run, since .env is not committed.
// Nothing under test here touches the client, so it is stubbed rather than
// configured.
vi.mock('./supabase', () => ({ supabase: {} }));

const { buildTemplateExerciseRows, normaliseName } = await import('./templateBundleImport');

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

describe('buildTemplateExerciseRows', () => {
  const template = (
    exercises: Array<{ name: string; group: number | null }>,
  ): BundleTemplate => ({
    name: 'Upper A',
    description: null,
    template_type: 'superset',
    category: 'Upper Body',
    exercises: exercises.map((e, i) => ({
      order_index: i,
      exercise_name: e.name,
      default_sets: 3,
      default_reps: 10,
      default_weight: 100,
      superset_group: e.group,
    })),
  });

  const resolveAll = (names: string[]) =>
    new Map(names.map((n) => [n.toLowerCase(), `id-${n}`] as const));

  it('carries pairing through to the rows', () => {
    // The bug in one line: this used to insert no superset_group at all, so
    // every imported template came back as straight sets.
    const { rows } = buildTemplateExerciseRows(
      't1',
      template([
        { name: 'Dips', group: 0 },
        { name: 'Pull-ups', group: 0 },
        { name: 'Seated Cable Rows', group: null },
      ]),
      resolveAll(['Dips', 'Pull-ups', 'Seated Cable Rows']),
      'lb',
    );

    expect(rows.map((r) => r.superset_group)).toEqual([0, 0, null]);
    expect(rows.map((r) => r.order_index)).toEqual([0, 1, 2]);
    expect(rows.every((r) => r.template_id === 't1')).toBe(true);
  });

  it('does not leave a superset with one member when its partner is skipped', () => {
    // Grouping has to be decided after the skips. Deciding it before would
    // store a group of one — a superset with nothing to alternate with.
    const resolved = new Map([['dips', 'id-dips']]);
    const { rows, skipped } = buildTemplateExerciseRows(
      't1',
      template([
        { name: 'Dips', group: 0 },
        { name: 'Muscle-ups', group: 0 },
      ]),
      resolved,
      'lb',
    );

    expect(skipped).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].superset_group).toBeNull();
  });

  it('does not join two exercises because the one between them was skipped', () => {
    const resolved = new Map([
      ['dips', 'id-dips'],
      ['face pulls', 'id-face-pulls'],
    ]);
    const { rows } = buildTemplateExerciseRows(
      't1',
      template([
        { name: 'Dips', group: 0 },
        { name: 'Muscle-ups', group: 0 },
        { name: 'Face Pulls', group: 1 },
      ]),
      resolved,
      'lb',
    );

    // Two survivors, now adjacent, but they were never meant to be paired.
    expect(rows.map((r) => r.superset_group)).toEqual([null, null]);
  });

  it('converts weight to kilograms for storage', () => {
    const { rows } = buildTemplateExerciseRows(
      't1',
      template([{ name: 'Dips', group: null }]),
      resolveAll(['Dips']),
      'lb',
    );
    expect(rows[0].default_weight).toBeCloseTo(45.359, 2);
  });
});
