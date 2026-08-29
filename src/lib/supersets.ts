/**
 * Which exercises are performed together.
 *
 * Until now this was never stored. `template_type` was a single flag for the
 * whole template and the UI inferred pairs from adjacency — `index % 2 === 0`.
 * So a template was entirely supersets or entirely not, a pair could not be
 * declared, and changing a partner meant reordering.
 *
 * That was tolerable while pairing was incidental layout. It stopped being
 * tolerable once the pairing became a deliberate design decision under
 * revision: you cannot tune a thing that is an ordering convention rather than
 * data.
 *
 * The model is a nullable group id per exercise. Members of a group are
 * performed together; null means a straight set with its own rest. Two rules
 * hold everywhere, and both are enforced by `normalise` rather than trusted:
 *
 *   **Groups are contiguous.** A group whose members are not adjacent cannot be
 *   performed as written, so a gap splits it.
 *
 *   **A group of one is not a group.** It is a straight set, and storing it as
 *   a group would make "is this supersetted" two questions instead of one.
 *
 * Every mutation returns a new list and ends in `normalise`, so no caller can
 * produce a state the rest of the app has to defend against.
 */

export interface Groupable {
  superset_group?: number | null;
}

/**
 * Split into contiguous runs, each run being one superset or one straight set.
 *
 * This is what rendering wants: draw a bracket around a run of more than one.
 */
export function groupRuns<T extends Groupable>(items: T[]): T[][] {
  const runs: T[][] = [];
  let current: T[] = [];
  let currentGroup: number | null | undefined;

  for (const item of items) {
    const group = item.superset_group ?? null;
    const continues = group !== null && group === currentGroup && current.length > 0;

    if (continues) {
      current.push(item);
    } else {
      if (current.length > 0) runs.push(current);
      current = [item];
      currentGroup = group;
    }
  }

  if (current.length > 0) runs.push(current);
  return runs;
}

/**
 * Which run each position belongs to, as a parallel array.
 *
 * Everything the workout screen asks — is this the current block, does a
 * divider go here, is the whole block finished — is really a question about
 * runs rather than about indices. Answering it once here keeps four call sites
 * from each reinventing the adjacency rule, which is how the old `index % 2`
 * assumption ended up spread across the codebase in the first place.
 */
export function runIndexes(items: Groupable[]): number[] {
  const result: number[] = [];
  let run = -1;
  let currentGroup: number | null = null;
  let started = false;

  for (const item of items) {
    const group = item.superset_group ?? null;
    const continues = started && group !== null && group === currentGroup;
    if (!continues) run++;
    result.push(run);
    currentGroup = group;
    started = true;
  }

  return result;
}

/** Whether this exercise and the one after it are performed together. */
export function isPairedWithNext(items: Groupable[], index: number): boolean {
  const a = items[index];
  const b = items[index + 1];
  if (!a || !b) return false;
  const ga = a.superset_group ?? null;
  return ga !== null && ga === (b.superset_group ?? null);
}

/** Whether an exercise is part of any superset at all. */
export function isInSuperset(items: Groupable[], index: number): boolean {
  return isPairedWithNext(items, index) || isPairedWithNext(items, index - 1);
}

/**
 * Renumber groups to 0..n in order, dropping any run of one to null.
 *
 * Called at the end of every mutation. Doing it here rather than in each
 * operation means a link, an unlink and a reorder cannot each invent their own
 * idea of a valid state — and reordering is exactly where a naive scheme
 * breaks, because moving an exercise out from between its partners has to
 * dissolve the group without anyone remembering to ask.
 */
export function normalise<T extends Groupable>(items: T[]): T[] {
  const runs = groupRuns(items);
  let nextGroup = 0;

  return runs.flatMap((run): T[] => {
    const group = run.length < 2 ? null : nextGroup++;
    return run.map((item) => ({ ...item, superset_group: group }));
  });
}

/** A group id no existing run is using, for building a new one. */
function freeGroup(items: Groupable[]): number {
  const used = items
    .map((i) => i.superset_group)
    .filter((g): g is number => typeof g === 'number');
  return used.length === 0 ? 0 : Math.max(...used) + 1;
}

/**
 * Join an exercise to the one below it.
 *
 * If either is already in a group, the groups merge — linking the second
 * member of a pair to a third makes a triple rather than silently breaking the
 * existing pair, which is what a user dragging things around expects.
 */
export function linkWithNext<T extends Groupable>(items: T[], index: number): T[] {
  if (index < 0 || index + 1 >= items.length) return items;

  const target = freeGroup(items);
  const runs = groupRuns(items);

  // Find which runs the two exercises belong to, by position.
  let position = 0;
  const runOf = new Map<number, number>();
  runs.forEach((run, runIndex) => {
    for (let i = 0; i < run.length; i++) runOf.set(position++, runIndex);
  });

  const runA = runOf.get(index);
  const runB = runOf.get(index + 1);

  position = 0;
  const merged = runs.flatMap((run, runIndex) =>
    run.map((item) => {
      position++;
      return runIndex === runA || runIndex === runB
        ? { ...item, superset_group: target }
        : item;
    }),
  );

  return normalise(merged);
}

/**
 * Take an exercise out of its group.
 *
 * Whatever is left either still has two adjacent members and stays a group, or
 * does not and dissolves. `normalise` decides, so unlinking the middle of a
 * triple correctly leaves two straight sets rather than a group with a hole.
 */
export function unlinkAt<T extends Groupable>(items: T[], index: number): T[] {
  if (index < 0 || index >= items.length) return items;
  return normalise(
    items.map((item, i) => (i === index ? { ...item, superset_group: null } : item)),
  );
}

/** Every exercise on its own. */
export function unlinkAll<T extends Groupable>(items: T[]): T[] {
  return items.map((item) => ({ ...item, superset_group: null }));
}

/** Pair them off two at a time, which is what every current template is. */
export function pairAllConsecutive<T extends Groupable>(items: T[]): T[] {
  return normalise(
    items.map((item, i) => ({ ...item, superset_group: Math.floor(i / 2) })),
  );
}

/** Whether any exercise is supersetted, for deciding what to show. */
export function hasAnySuperset(items: Groupable[]): boolean {
  return groupRuns(items).some((run) => run.length > 1);
}
