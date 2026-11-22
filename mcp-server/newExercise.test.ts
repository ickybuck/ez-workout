import { describe, it, expect } from 'vitest';
import { checkNewName } from './newExercise';

const library = [
  { name: 'Hip Abductor' },
  { name: 'Hip Adductor' },
  { name: 'Leg Press' },
  { name: 'Bicep Curls' },
  { name: 'Hammer Curls' },
  { name: 'Incline DB Press' },
];

describe('checkNewName', () => {
  it('finds the same name regardless of case, spacing and punctuation', () => {
    expect(checkNewName('leg-press', library).same).toBe('Leg Press');
    expect(checkNewName('LegPress', library).same).toBe('Leg Press');
  });

  it('flags a name that contains an existing one, or is contained by it', () => {
    expect(checkNewName('Leg Press Narrow Stance', library).similar).toEqual(['Leg Press']);
    expect(checkNewName('Press', library).similar).toEqual(['Incline DB Press', 'Leg Press']);
  });

  it('flags word-stem matches: abduction is the abductor, not the adductor', () => {
    expect(checkNewName('Hip Abduction', library).similar).toEqual(['Hip Abductor']);
    expect(checkNewName('Hip Adduction', library).similar).toEqual(['Hip Adductor']);
  });

  it('does not flag a genuinely different exercise', () => {
    expect(checkNewName('Cable Crunch', library)).toEqual({ same: null, similar: [] });
    expect(checkNewName('Preacher Curls', library)).toEqual({ same: null, similar: [] });
  });

  it('flags a singular of an existing plural', () => {
    expect(checkNewName('Bicep Curl', library).similar).toEqual(['Bicep Curls']);
  });
});
