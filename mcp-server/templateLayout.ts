/*
 * Template edits as list operations.
 *
 * A template is an ordered list of exercises, some of them joined into
 * supersets. Every edit a person can ask for -- add one here, take one out,
 * move one, pair two, split a pair -- is an operation on that list, and every
 * one of them has to leave it in a state the app can perform: groups
 * contiguous, no group of one. src/lib/supersets.ts already owns those rules
 * and the app's editor uses them; this file only says which of its operations
 * each request means, so the server and the app cannot disagree about what
 * "pair it with the next one" does.
 *
 * Positions here are 1-based, because they are what a person says ("make it
 * the third exercise"). Everything is pure; the tool reads the rows, plans
 * with these, and writes the result through the scope.
 */

import { linkWithNext, normalise, unlinkAt, type Groupable } from '../src/lib/supersets';

export interface LayoutItem extends Groupable {
  /** Row id, or a placeholder for a row not yet inserted. */
  key: string;
  superset_group: number | null;
}

export class LayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LayoutError';
  }
}

function checkPosition(position: number, max: number, what: string): number {
  if (!Number.isInteger(position) || position < 1 || position > max) {
    throw new LayoutError(`${what} must be between 1 and ${max}.`);
  }
  return position - 1;
}

/**
 * Insert at a 1-based position (default: the end). With `superset`, the new
 * exercise joins whatever is directly above it -- a straight set becomes a
 * pair, a pair becomes a triple.
 */
export function insertItem(
  items: LayoutItem[],
  item: LayoutItem,
  { position, superset = false }: { position?: number; superset?: boolean } = {},
): LayoutItem[] {
  const index = position == null ? items.length : checkPosition(position, items.length + 1, 'Position');
  if (superset && index === 0) {
    throw new LayoutError('The first exercise has nothing above it to superset with.');
  }

  // Inserting into the middle of a group splits it at that point unless the
  // newcomer is joining it; give it no group, then link if asked.
  const next = [...items.slice(0, index), { ...item, superset_group: null }, ...items.slice(index)];
  const placed = normalise(splitAround(next, index));
  return superset ? linkWithNext(placed, index - 1) : placed;
}

/**
 * Break any group that spans `index`, so a plain insert into the middle of a
 * pair leaves two straight sets rather than a pair with a stranger in it.
 */
function splitAround(items: LayoutItem[], index: number): LayoutItem[] {
  const above = items[index - 1]?.superset_group ?? null;
  const below = items[index + 1]?.superset_group ?? null;
  if (above === null || above !== below) return items;

  const fresh = Math.max(...items.map((i) => i.superset_group ?? -1)) + 1;
  return items.map((item, i) => (i > index && item.superset_group === above ? { ...item, superset_group: fresh } : item));
}

export function removeItem(items: LayoutItem[], key: string): LayoutItem[] {
  const index = items.findIndex((i) => i.key === key);
  if (index < 0) throw new LayoutError('That exercise is not in this template.');
  // normalise dissolves a pair left with one member.
  return normalise(items.filter((_, i) => i !== index));
}

/**
 * Move to a 1-based position. The exercise leaves its superset first: a pair
 * is a decision about two exercises side by side, and moving one of them away
 * is not a request to drag its partner along.
 */
export function moveItem(items: LayoutItem[], key: string, position: number): LayoutItem[] {
  const from = items.findIndex((i) => i.key === key);
  if (from < 0) throw new LayoutError('That exercise is not in this template.');
  const to = checkPosition(position, items.length, 'Position');

  const freed = unlinkAt(items, from);
  const [moving] = freed.splice(from, 1);
  freed.splice(to, 0, moving);
  return normalise(splitAround(freed, to));
}

/** Join an exercise to the one directly below it. */
export function pairWithNext(items: LayoutItem[], key: string): LayoutItem[] {
  const index = items.findIndex((i) => i.key === key);
  if (index < 0) throw new LayoutError('That exercise is not in this template.');
  if (index + 1 >= items.length) throw new LayoutError('That is the last exercise, so there is nothing below it to pair with.');
  return linkWithNext(items, index);
}

/** Take an exercise out of its superset; what is left stays paired if it still can. */
export function unpair(items: LayoutItem[], key: string): LayoutItem[] {
  const index = items.findIndex((i) => i.key === key);
  if (index < 0) throw new LayoutError('That exercise is not in this template.');
  return unlinkAt(items, index);
}
