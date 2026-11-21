import { describe, it, expect } from 'vitest';
import {
  matchExercise,
  canonical,
  AmbiguousExerciseError,
  UnknownExerciseError,
} from './matchExercise';

/*
 * The real library, as seeded in production on 2026-11-20. Using the actual
 * names matters: the interesting cases here are collisions that only exist
 * because of what is in it -- "Hip Abductor" against "Hip Adductor", three
 * kinds of fly, five kinds of curl, and three names carrying a trailing space.
 */
const NAMES = [
  'Ab Crunch Machine ',
  'Ab Rollouts',
  'Back Extensions',
  'Bench Press',
  'Bent Over Rows',
  'Bicep Curls',
  'Bicycle Crunch',
  'Cable Curls',
  'Cable External Rotation',
  'Cable Flyes',
  'Cable Upright Row',
  'Cable Woodchoppers',
  'Chest Press ',
  'Crunches',
  'Dead Bug',
  'Deadlift',
  'Decline Bench Press',
  'Dips',
  'Dumbbell Flyes',
  'Dumbbell Shoulder Press',
  'Face Pulls',
  'Front Raises',
  'Front Step Ups',
  'Glute Kickbacks',
  'Hack Squats',
  'Hammer Curls',
  'Hanging Leg Raises',
  'Hip Abductor',
  'Hip Adductor',
  'Hip Thrust ',
  'Incline Bench Press',
  'Incline Dumbbell Curl',
  'Incline Dumbbell Press',
  'Lateral Raises',
  'Lat Pulldowns',
  'Leg Curls',
  'Leg Extensions',
  'Leg Press',
  'Lunges',
  'Meadows Rows',
  'Mountain Climbers',
  'Overhead Press',
  'Overhead Tricep Extension',
  'Pallof Press',
  'Pec Deck',
  'Planks',
  'Preacher Curls',
  'Pull-ups',
  'Push Press',
  'Push-Ups',
  'Reverse Flyes',
  'Romanian Deadlift',
  'Russian Twists',
  'Seated Cable Rows',
  'Seated Calf Raises',
  'Seated Row Machine',
  'Shoulder Press',
  'Side Plank',
  'Skull Crushers',
  'Split Squats',
  'Squats',
  'Standing Calf Raises',
  'Suitcase Carry',
  'T-Bar Rows',
  'Tricep Pushdowns',
];

const POOL = NAMES.map((name, i) => ({ id: `e-${i}`, name }));
const find = (query: string) => matchExercise(query, POOL).exercise.name;

describe('canonical', () => {
  it('flattens case, punctuation and stray space', () => {
    expect(canonical('  Pull-ups ')).toBe('pull ups');
    expect(canonical('Ab Crunch Machine ')).toBe('ab crunch machine');
    expect(canonical('T-Bar Rows')).toBe('t bar rows');
  });
});

describe('exact matching wins before anything looser', () => {
  it('matches regardless of case and surrounding space', () => {
    expect(find('leg press')).toBe('Leg Press');
    expect(find('  LEG PRESS  ')).toBe('Leg Press');
  });

  it('matches the names carrying a trailing space in the library', () => {
    expect(find('chest press')).toBe('Chest Press ');
    expect(find('hip thrust')).toBe('Hip Thrust ');
    expect(find('ab crunch machine')).toBe('Ab Crunch Machine ');
  });

  it('prefers the exact name over the longer ones containing it', () => {
    // "Bench Press" also sits inside Incline and Decline Bench Press, and
    // "Shoulder Press" inside Dumbbell Shoulder Press. Asking for the short
    // one must not be ambiguous.
    expect(find('bench press')).toBe('Bench Press');
    expect(find('shoulder press')).toBe('Shoulder Press');
    expect(find('squats')).toBe('Squats');
  });

  it('ignores punctuation and spacing differences', () => {
    expect(find('pullups')).toBe('Pull-ups');
    expect(find('push ups')).toBe('Push-Ups');
    expect(find('tbar rows')).toBe('T-Bar Rows');
  });
});

describe('abductor against adductor', () => {
  it('matches each exactly', () => {
    expect(find('hip abductor')).toBe('Hip Abductor');
    expect(find('hip adductor')).toBe('Hip Adductor');
  });

  it('never silently substitutes one for the other', () => {
    // One letter apart, opposite movements, different machines. Any
    // edit-distance or "closest match" scoring would swap them, and the set
    // would be logged against the wrong exercise -- which is not rewritten
    // afterwards to match what was actually done.
    expect(() => matchExercise('hip abducter', POOL)).toThrow(UnknownExerciseError);
    expect(() => matchExercise('abducter', POOL)).toThrow(UnknownExerciseError);
  });

  it('resolves the shortened forms people actually say', () => {
    expect(find('abductor')).toBe('Hip Abductor');
    expect(find('adductor')).toBe('Hip Adductor');
    expect(find('hip ab')).toBe('Hip Abductor');
  });
});

describe('prefix and word matching', () => {
  it('takes a unique prefix', () => {
    expect(find('romanian')).toBe('Romanian Deadlift');
    expect(find('suitcase')).toBe('Suitcase Carry');
  });

  it('takes words in any order when only one exercise has them all', () => {
    expect(find('press leg')).toBe('Leg Press');
    expect(find('pulldowns lat')).toBe('Lat Pulldowns');
  });

  it('reports what it found rather than picking, when several fit', () => {
    // Five things are curls and three are flyes. A guess here is a set logged
    // against the wrong lift.
    const err = matchExercise.bind(null, 'curls', POOL);
    expect(err).toThrow(AmbiguousExerciseError);
    expect(err).toThrow(/Bicep Curls/);

    expect(() => matchExercise('flyes', POOL)).toThrow(/Cable Flyes.*Dumbbell Flyes.*Reverse Flyes/);
  });

  it('treats calf raises as ambiguous, because it is', () => {
    // Seated and Standing are different exercises with different loads. The
    // 2026-09 rebuild pairs Standing with Leg Curls specifically.
    expect(() => matchExercise('calf raises', POOL)).toThrow(AmbiguousExerciseError);
    expect(find('standing calf raises')).toBe('Standing Calf Raises');
  });

  it('treats an incomplete incline dumbbell as ambiguous', () => {
    expect(() => matchExercise('incline dumbbell', POOL)).toThrow(/Incline Dumbbell Curl/);
    expect(find('incline dumbbell curl')).toBe('Incline Dumbbell Curl');
  });
});

describe('refusals', () => {
  it('rejects a name that matches nothing', () => {
    expect(() => matchExercise('kettlebell swing', POOL)).toThrow(UnknownExerciseError);
  });

  it('rejects an empty query', () => {
    expect(() => matchExercise('   ', POOL)).toThrow(UnknownExerciseError);
    expect(() => matchExercise('!!', POOL)).toThrow(UnknownExerciseError);
  });

  it('reports how a loose match was reached', () => {
    // The caller shows this, so a word-level match stays visible rather than
    // looking as certain as an exact one.
    expect(matchExercise('leg press', POOL).kind).toBe('exact');
    expect(matchExercise('romanian', POOL).kind).toBe('prefix');
    expect(matchExercise('press leg', POOL).kind).toBe('words');
  });

  it('accepts a duplicate seeding of one name without asking', () => {
    const twice = [
      { id: 'a', name: 'Leg Press' },
      { id: 'b', name: 'Leg Press' },
    ];
    expect(matchExercise('leg press', twice).exercise.id).toBe('a');
  });
});
