import { describe, it, expect } from 'vitest';
import {
  groupRuns,
  isPairedWithNext,
  isInSuperset,
  normalise,
  linkWithNext,
  unlinkAt,
  unlinkAll,
  pairAllConsecutive,
  hasAnySuperset,
} from './supersets';

/** A list written the way it reads: 'a0' is exercise a in group 0, 'b-' is solo. */
const list = (spec: string) =>
  spec.split(' ').map((token) => ({
    name: token[0],
    superset_group: token[1] === '-' ? null : Number(token.slice(1)),
  }));

const shape = (items: { name: string; superset_group?: number | null }[]) =>
  items.map((i) => `${i.name}${i.superset_group ?? '-'}`).join(' ');

describe('groupRuns', () => {
  it('splits into supersets and straight sets', () => {
    const runs = groupRuns(list('a0 b0 c- d1 e1'));
    expect(runs.map((r) => r.map((x) => x.name).join(''))).toEqual(['ab', 'c', 'de']);
  });

  it('treats each solo exercise as its own run', () => {
    expect(groupRuns(list('a- b- c-'))).toHaveLength(3);
  });

  it('splits a group whose members are not adjacent', () => {
    // Two exercises sharing a number with something else in between cannot be
    // performed as written, so they are not one superset.
    const runs = groupRuns(list('a0 b1 c0'));
    expect(runs).toHaveLength(3);
  });

  it('handles an empty list', () => {
    expect(groupRuns([])).toEqual([]);
  });
});

describe('normalise', () => {
  it('renumbers groups in order', () => {
    expect(shape(normalise(list('a5 b5 c- d9 e9')))).toBe('a0 b0 c- d1 e1');
  });

  it('dissolves a group of one, because that is a straight set', () => {
    expect(shape(normalise(list('a3 b- c-')))).toBe('a- b- c-');
  });

  it('splits a non-adjacent group rather than keeping a hole in it', () => {
    expect(shape(normalise(list('a0 b1 c0')))).toBe('a- b- c-');
  });

  it('leaves an already-valid list alone', () => {
    expect(shape(normalise(list('a0 b0 c- d1 e1')))).toBe('a0 b0 c- d1 e1');
  });
});

describe('linkWithNext', () => {
  it('joins two straight sets into a superset', () => {
    expect(shape(linkWithNext(list('a- b- c-'), 0))).toBe('a0 b0 c-');
  });

  it('extends an existing pair into a triple rather than breaking it', () => {
    // Dragging a third exercise onto a pair should grow the pair, not silently
    // evict one of its members.
    expect(shape(linkWithNext(list('a0 b0 c-'), 1))).toBe('a0 b0 c0');
  });

  it('merges two adjacent pairs into one group', () => {
    expect(shape(linkWithNext(list('a0 b0 c1 d1'), 1))).toBe('a0 b0 c0 d0');
  });

  it('does nothing at the end of the list', () => {
    const input = list('a- b-');
    expect(linkWithNext(input, 1)).toBe(input);
    expect(linkWithNext(input, 5)).toBe(input);
  });

  it('does not mutate the list it was given', () => {
    const input = list('a- b-');
    linkWithNext(input, 0);
    expect(shape(input)).toBe('a- b-');
  });
});

describe('unlinkAt', () => {
  it('breaks a pair into two straight sets', () => {
    expect(shape(unlinkAt(list('a0 b0'), 0))).toBe('a- b-');
  });

  it('leaves two straight sets when the middle of a triple is removed', () => {
    // The case a naive implementation gets wrong: a and c are no longer
    // adjacent, so they are not a superset any more either.
    expect(shape(unlinkAt(list('a0 b0 c0'), 1))).toBe('a- b- c-');
  });

  it('keeps the remainder together when an end of a triple is removed', () => {
    expect(shape(unlinkAt(list('a0 b0 c0'), 0))).toBe('a- b0 c0');
  });

  it('renumbers what is left', () => {
    expect(shape(unlinkAt(list('a0 b0 c1 d1'), 0))).toBe('a- b- c0 d0');
  });

  it('ignores an index outside the list', () => {
    const input = list('a0 b0');
    expect(unlinkAt(input, 9)).toBe(input);
  });
});

describe('isPairedWithNext and isInSuperset', () => {
  it('reads a pair from either side', () => {
    const items = list('a0 b0 c-');
    expect(isPairedWithNext(items, 0)).toBe(true);
    expect(isPairedWithNext(items, 1)).toBe(false);
    expect(isInSuperset(items, 0)).toBe(true);
    expect(isInSuperset(items, 1)).toBe(true);
    expect(isInSuperset(items, 2)).toBe(false);
  });

  it('does not pair two straight sets that happen to be adjacent', () => {
    expect(isPairedWithNext(list('a- b-'), 0)).toBe(false);
  });

  it('is safe at the edges', () => {
    expect(isPairedWithNext(list('a0 b0'), 1)).toBe(false);
    expect(isInSuperset(list('a-'), 0)).toBe(false);
  });
});

describe('bulk operations', () => {
  it('pairs everything two at a time, which is every current template', () => {
    expect(shape(pairAllConsecutive(list('a- b- c- d-')))).toBe('a0 b0 c1 d1');
  });

  it('leaves a trailing odd exercise as a straight set', () => {
    expect(shape(pairAllConsecutive(list('a- b- c-')))).toBe('a0 b0 c-');
  });

  it('unlinks everything', () => {
    expect(shape(unlinkAll(list('a0 b0 c1 d1')))).toBe('a- b- c- d-');
  });

  it('reports whether anything is supersetted', () => {
    expect(hasAnySuperset(list('a- b-'))).toBe(false);
    expect(hasAnySuperset(list('a0 b0'))).toBe(true);
    // A stored group of one is not a superset, whatever the column says.
    expect(hasAnySuperset(list('a0 b- c-'))).toBe(false);
  });
});

describe('the mixed template this was built for', () => {
  it('supports pairs and straight sets in one list', () => {
    // Deadlift alone, then two accessory pairs — the shape the research says
    // Eric's templates should move toward.
    let items = list('a- b- c- d- e-');
    items = linkWithNext(items, 1);
    items = linkWithNext(items, 3);
    expect(shape(items)).toBe('a- b0 c0 d1 e1');
    expect(hasAnySuperset(items)).toBe(true);
    expect(isInSuperset(items, 0)).toBe(false);
  });

  it('survives unpairing the heavy lift out of a fully paired template', () => {
    // Exactly the change the research recommends: the current templates pair a
    // heavy compound with core, and the compound should come out.
    const items = unlinkAt(list('a0 b0 c1 d1 e2 f2'), 0);
    expect(shape(items)).toBe('a- b- c0 d0 e1 f1');
  });
});
