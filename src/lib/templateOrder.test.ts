import { describe, it, expect } from 'vitest';
import { planReorder, PARKING_OFFSET } from './templateOrder';

/** Applies a plan the way the database would, enforcing the unique index. */
function apply(rows: Array<{ id: string; order_index: number; superset_group?: number | null }>, plan: ReturnType<typeof planReorder>) {
  const state = new Map(rows.map((r) => [r.id, { ...r }]));
  const write = (id: string, order_index: number, superset_group?: number | null) => {
    for (const [otherId, other] of state) {
      if (otherId !== id && other.order_index === order_index) {
        throw new Error(`unique violation: ${id} onto ${order_index} held by ${otherId}`);
      }
    }
    const row = state.get(id)!;
    row.order_index = order_index;
    if (superset_group !== undefined) row.superset_group = superset_group;
  };
  for (const p of plan.park) write(p.id, p.order_index);
  for (const p of plan.place) write(p.id, p.order_index, p.superset_group);
  return [...state.values()].sort((a, b) => a.order_index - b.order_index);
}

const rows = [
  { id: 'a', order_index: 0, superset_group: null },
  { id: 'b', order_index: 1, superset_group: null },
  { id: 'c', order_index: 2, superset_group: null },
];

describe('planReorder', () => {
  it('swaps two rows without ever holding one index twice (EZ-51)', () => {
    const plan = planReorder(rows, [{ id: 'b' }, { id: 'a' }, { id: 'c' }]);
    expect(apply(rows, plan).map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });

  it('the naive one-pass write is what fails', () => {
    // The shape of the old save: every row straight to its new index.
    expect(() =>
      apply(rows, { park: [], place: [{ id: 'b', order_index: 0, superset_group: null }, { id: 'a', order_index: 1, superset_group: null }] }),
    ).toThrow(/unique violation/);
  });

  it('rotates the whole list', () => {
    const plan = planReorder(rows, [{ id: 'c' }, { id: 'a' }, { id: 'b' }]);
    expect(apply(rows, plan).map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });

  it('closes a gap left by a removed row', () => {
    const gappy = [
      { id: 'a', order_index: 0 },
      { id: 'c', order_index: 2 },
    ];
    const plan = planReorder(gappy, [{ id: 'a' }, { id: 'c' }]);
    expect(apply(gappy, plan).map((r) => [r.id, r.order_index])).toEqual([
      ['a', 0],
      ['c', 1],
    ]);
  });

  it('leaves unchanged rows alone and parks clear of real indexes', () => {
    const plan = planReorder(rows, [{ id: 'a' }, { id: 'c' }, { id: 'b' }]);
    expect(plan.park.map((p) => p.id)).toEqual(['c', 'b']);
    expect(plan.park.every((p) => p.order_index >= PARKING_OFFSET)).toBe(true);
    expect(plan.place.map((p) => p.id)).toEqual(['c', 'b']);
  });

  it('writes a pairing change without parking a row that does not move', () => {
    const plan = planReorder(rows, [
      { id: 'a', superset_group: 0 },
      { id: 'b', superset_group: 0 },
      { id: 'c' },
    ]);
    expect(plan.park).toEqual([]);
    expect(plan.place).toEqual([
      { id: 'a', order_index: 0, superset_group: 0 },
      { id: 'b', order_index: 1, superset_group: 0 },
    ]);
  });

  it('refuses a list that adds or drops a row', () => {
    expect(() => planReorder(rows, [{ id: 'a' }, { id: 'b' }])).toThrow(/exactly the rows/);
    expect(() => planReorder(rows, [{ id: 'a' }, { id: 'b' }, { id: 'z' }])).toThrow(/exactly the rows/);
  });
});
