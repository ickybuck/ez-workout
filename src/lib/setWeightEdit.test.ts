import { describe, it, expect } from 'vitest';
import { planWeightEdit } from './setWeightEdit';

const base = {
  workoutExerciseId: 'we-1',
  exerciseId: 'ex-1',
  setNumber: 2,
  weightKg: 27.216,
};

describe('planWeightEdit', () => {
  it('touches only the one set when the scope is this set', () => {
    const plan = planWeightEdit({ ...base, scope: 'set' });

    expect(plan.logs).toEqual({ workoutExerciseId: 'we-1', fromSetNumber: 2, toSetNumber: 2 });
    expect(plan.updatesDefaults).toBe(false);
    expect(plan.updatesTemplates).toBe(false);
  });

  it('touches this set and everything after it when the scope is the rest', () => {
    const plan = planWeightEdit({ ...base, scope: 'rest' });

    expect(plan.logs).toEqual({ workoutExerciseId: 'we-1', fromSetNumber: 2, toSetNumber: null });
    expect(plan.updatesDefaults).toBe(true);
    expect(plan.updatesTemplates).toBe(true);
  });

  it('does not rewrite the prescription for a single-set change', () => {
    // The point of the whole feature. Dropping to 60 lb on the last set
    // because you are tired must not edit the template down to 60 — which is
    // what adjustWeight did for every change, drop set or not.
    const plan = planWeightEdit({ ...base, scope: 'set' });
    expect(plan.updatesDefaults).toBe(false);
    expect(plan.updatesTemplates).toBe(false);
  });

  it('carries the weight through unchanged, in kilograms', () => {
    // Conversion belongs to the caller; this decides scope, not units.
    expect(planWeightEdit({ ...base, scope: 'set' }).weightKg).toBe(27.216);
  });

  it('refuses a negative weight', () => {
    expect(() => planWeightEdit({ ...base, weightKg: -1, scope: 'set' })).toThrow(/negative/i);
  });

  it('allows zero, which is every bodyweight movement', () => {
    expect(planWeightEdit({ ...base, weightKg: 0, scope: 'set' }).weightKg).toBe(0);
  });

  it('refuses a set number below one', () => {
    expect(() => planWeightEdit({ ...base, setNumber: 0, scope: 'set' })).toThrow(/set number/i);
  });

  it('describes what it will do, for the confirmation line', () => {
    expect(planWeightEdit({ ...base, scope: 'set' }).affects).toBe('this set only');
    expect(planWeightEdit({ ...base, scope: 'rest' }).affects).toBe('this set, the rest, and the template');
  });
});
