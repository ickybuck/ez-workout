/*
 * Turning a spoken name into an exercise.
 *
 * Every tool here takes exercise names, not ids, because the caller is a
 * person holding a phone between sets. "leg press", "Leg Press", "legpress"
 * and "seated leg press" all have to land on the same row, and when they
 * genuinely cannot, the answer must be a question rather than a guess --
 * logging 10 at 80 kg against the wrong exercise is history that does not get
 * rewritten later (EZ-11, EZ-42).
 *
 * So matching is deliberately layered, strictest first, and stops at the
 * first layer that produces exactly one candidate:
 *
 *   1. exact, ignoring case, surrounding space and inner punctuation
 *   2. one candidate starts with the query
 *   3. one candidate contains every word of the query, in any order
 *
 * Anything that matches several rows is ambiguous and says so, listing what
 * it found. Nothing here scores or ranks: a near-miss that silently wins is
 * the failure mode this is built to avoid.
 */

export interface MatchableExercise {
  id: string;
  name: string;
}

export type MatchKind = 'exact' | 'prefix' | 'words';

export interface ExerciseMatch<T extends MatchableExercise> {
  exercise: T;
  /** How it was found. Reported back so a loose match stays visible. */
  kind: MatchKind;
}

export class AmbiguousExerciseError extends Error {
  readonly candidates: string[];

  constructor(query: string, candidates: string[], noun = 'exercise') {
    super(
      `"${query}" matches ${candidates.length} ${noun}s: ${candidates.join(', ')}. ` +
        'Name one of them exactly.',
    );
    this.name = 'AmbiguousExerciseError';
    this.candidates = candidates;
  }
}

export class UnknownExerciseError extends Error {
  constructor(query: string, noun = 'exercise', known?: string[]) {
    super(
      `No ${noun} matches "${query}".` + (known?.length ? ` Known ${noun}s: ${known.join(', ')}.` : ''),
    );
    this.name = 'UnknownExerciseError';
  }
}

/** Lower case, trimmed, punctuation and runs of space flattened. */
export function canonical(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Same, with spaces removed too, so "legpress" reaches "leg press". */
function squashed(name: string): string {
  return canonical(name).replace(/ /g, '');
}

/**
 * Also used for templates, equipment, body parts and muscle groups: the same
 * strictness applies to any name a person says. `noun` only changes the
 * wording of a refusal, and `listKnown` adds the full list to "no match" when
 * the pool is short enough to be worth reading.
 */
export function matchExercise<T extends MatchableExercise>(
  query: string,
  pool: T[],
  { noun = 'exercise', listKnown = false }: { noun?: string; listKnown?: boolean } = {},
): ExerciseMatch<T> {
  const unknown = () =>
    new UnknownExerciseError(query, noun, listKnown ? [...new Set(pool.map((p) => p.name))] : undefined);
  const wanted = canonical(query);
  if (!wanted) throw unknown();

  const indexed = pool.map((exercise) => ({
    exercise,
    canonical: canonical(exercise.name),
    squashed: squashed(exercise.name),
  }));

  const pick = (hits: typeof indexed, kind: MatchKind): ExerciseMatch<T> | null => {
    if (hits.length === 1) return { exercise: hits[0].exercise, kind };
    if (hits.length > 1) {
      // Distinct names only: the same exercise seeded twice under one name is
      // a data problem to report elsewhere, not a question for the user.
      const names = [...new Set(hits.map((h) => h.exercise.name))];
      if (names.length === 1) return { exercise: hits[0].exercise, kind };
      throw new AmbiguousExerciseError(query, names, noun);
    }
    return null;
  };

  const wantedSquashed = squashed(query);

  const exact =
    pick(
      indexed.filter((h) => h.canonical === wanted),
      'exact',
    ) ??
    pick(
      indexed.filter((h) => h.squashed === wantedSquashed),
      'exact',
    );
  if (exact) return exact;

  const prefix = pick(
    indexed.filter((h) => h.canonical.startsWith(wanted) || h.squashed.startsWith(wantedSquashed)),
    'prefix',
  );
  if (prefix) return prefix;

  const words = wanted.split(' ');
  const byWords = pick(
    indexed.filter((h) => words.every((word) => h.canonical.includes(word))),
    'words',
  );
  if (byWords) return byWords;

  throw unknown();
}
