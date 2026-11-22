/*
 * Is this new exercise really new?
 *
 * The library is shared, and the matcher that finds exercises by name is
 * strict on purpose: it will not guess between "Hip Abductor" and "Hip
 * Adductor", one letter apart and opposite movements. The cost of that
 * strictness is that a near-duplicate added to the library makes every later
 * "log hip abduction" ambiguous for everyone. So before an exercise is added,
 * this looks for names that are the same, or close enough that a person
 * would likely have meant the existing one:
 *
 *   same       identical once case, spacing and punctuation are ignored.
 *              Refused outright; the database's unique index would refuse it
 *              anyway, with a worse message.
 *   similar    one name contains the other ("Leg Press" / "Leg Press Narrow
 *              Stance"), or every word of the shorter name starts the same as
 *              a word in the longer one ("Hip Abduction" / "Hip Abductor").
 *              Allowed only when the caller confirms it is a different
 *              exercise.
 *
 * Deliberately not edit distance: "Abductor" and "Adductor" are one edit
 * apart, and treating them as the same is exactly the confusion to avoid.
 */

import { canonical } from './matchExercise';

const STEM = 5;

function stem(word: string): string {
  return word.slice(0, STEM);
}

/** Plural and singular are the same word here: Curl and Curls. */
function singular(word: string): string {
  return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
}

function wordsAlike(shorter: string[], longer: string[]): boolean {
  return shorter.map(singular).every((word) =>
    longer.map(singular).some((other) =>
      word.length < STEM || other.length < STEM ? word === other : stem(word) === stem(other),
    ),
  );
}

export interface NameCheck {
  same: string | null;
  similar: string[];
}

export function checkNewName(name: string, library: Array<{ name: string }>): NameCheck {
  const wanted = canonical(name);
  const wantedSquashed = wanted.replace(/ /g, '');
  const wantedWords = wanted.split(' ').filter(Boolean);

  let same: string | null = null;
  const similar: string[] = [];

  for (const { name: existing } of library) {
    const theirs = canonical(existing);
    if (theirs === wanted || theirs.replace(/ /g, '') === wantedSquashed) {
      same = existing;
      continue;
    }

    const theirWords = theirs.split(' ').filter(Boolean);
    const [short, long] = wantedWords.length <= theirWords.length ? [wantedWords, theirWords] : [theirWords, wantedWords];
    const contains = ` ${theirs} `.includes(` ${wanted} `) || ` ${wanted} `.includes(` ${theirs} `);

    if (contains || wordsAlike(short, long)) similar.push(existing);
  }

  return { same, similar: [...new Set(similar)].sort() };
}
