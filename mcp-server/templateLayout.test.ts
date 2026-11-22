import { describe, it, expect } from 'vitest';
import { insertItem, moveItem, pairWithNext, removeItem, unpair, type LayoutItem } from './templateLayout';

const item = (key: string, superset_group: number | null = null): LayoutItem => ({ key, superset_group });

/** "a b+c d" style rendering: + joins members of one superset. */
function show(items: LayoutItem[]): string {
  return items
    .map((it, i) => {
      const joined = i > 0 && it.superset_group !== null && it.superset_group === items[i - 1].superset_group;
      return (joined ? '+' : ' ') + it.key;
    })
    .join('')
    .trim();
}

// squats, then bench paired with rows, then curls
const base = [item('squat'), item('bench', 0), item('row', 0), item('curl')];

describe('insertItem', () => {
  it('appends by default as a straight set', () => {
    expect(show(insertItem(base, item('new')))).toBe('squat bench+row curl new');
  });

  it('inserts at a 1-based position', () => {
    expect(show(insertItem(base, item('new'), { position: 1 }))).toBe('new squat bench+row curl');
  });

  it('joins the exercise above when asked, making a pair', () => {
    expect(show(insertItem(base, item('new'), { position: 2, superset: true }))).toBe('squat+new bench+row curl');
  });

  it('joins an existing pair to make a triple', () => {
    expect(show(insertItem(base, item('new'), { position: 4, superset: true }))).toBe('squat bench+row+new curl');
  });

  it('a plain insert between two partners splits the pair', () => {
    expect(show(insertItem(base, item('new'), { position: 3 }))).toBe('squat bench new row curl');
  });

  it('refuses a superset with nothing above it, and a position off the end', () => {
    expect(() => insertItem(base, item('new'), { position: 1, superset: true })).toThrow(/nothing above/);
    expect(() => insertItem(base, item('new'), { position: 6 })).toThrow(/between 1 and 5/);
  });
});

describe('removeItem', () => {
  it('dissolves a pair left with one member', () => {
    expect(show(removeItem(base, 'row'))).toBe('squat bench curl');
  });

  it('refuses an exercise that is not there', () => {
    expect(() => removeItem(base, 'nope')).toThrow(/not in this template/);
  });
});

describe('moveItem', () => {
  it('takes the exercise out of its pair before moving it', () => {
    expect(show(moveItem(base, 'bench', 4))).toBe('squat row curl bench');
  });

  it('moves a straight set without disturbing a pair', () => {
    expect(show(moveItem(base, 'curl', 1))).toBe('curl squat bench+row');
  });

  it('moving between partners splits them', () => {
    expect(show(moveItem(base, 'squat', 2))).toBe('bench squat row curl');
  });
});

describe('pairing', () => {
  it('pairs with the next exercise', () => {
    expect(show(pairWithNext(base, 'squat'))).toBe('squat+bench+row curl');
    expect(show(pairWithNext(base, 'row'))).toBe('squat bench+row+curl');
  });

  it('refuses to pair the last exercise', () => {
    expect(() => pairWithNext(base, 'curl')).toThrow(/last exercise/);
  });

  it('unpairs, dissolving what is left of a pair', () => {
    expect(show(unpair(base, 'bench'))).toBe('squat bench row curl');
  });
});
