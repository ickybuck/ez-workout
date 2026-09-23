import { describe, it, expect } from 'vitest';
import { fetchAllPages, PAGE_SIZE } from './paging';

/** A fake table that answers like PostgREST: never more than `maxRows` at once. */
const table = (total: number, maxRows = PAGE_SIZE) => {
  const ranges: Array<[number, number]> = [];
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));

  return {
    ranges,
    page: (from: number, to: number) => {
      ranges.push([from, to]);
      const size = Math.min(to - from + 1, maxRows);
      return Promise.resolve({ data: rows.slice(from, from + size), error: null });
    },
  };
};

describe('fetchAllPages', () => {
  it('returns everything past the first page, in order', async () => {
    const t = table(2500);
    const rows = await fetchAllPages(t.page);

    expect(rows).toHaveLength(2500);
    expect(rows[0].id).toBe(0);
    expect(rows[2499].id).toBe(2499);
  });

  it('asks for explicit ranges rather than trusting the default', async () => {
    const t = table(1500);
    await fetchAllPages(t.page);
    expect(t.ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it('stops after one request when everything fits', async () => {
    const t = table(10);
    expect(await fetchAllPages(t.page)).toHaveLength(10);
    expect(t.ranges).toHaveLength(1);
  });

  it('pays one empty request when the total divides by the page size', async () => {
    // The boundary. Stopping on a full page would miss anything after it;
    // stopping on an empty one costs a request and cannot be wrong.
    const t = table(2000);
    expect(await fetchAllPages(t.page)).toHaveLength(2000);
    expect(t.ranges).toHaveLength(3);
  });

  it('handles an empty table', async () => {
    const t = table(0);
    expect(await fetchAllPages(t.page)).toEqual([]);
    expect(t.ranges).toHaveLength(1);
  });

  it('throws the query error rather than returning a short answer', async () => {
    const failing = () => Promise.resolve({ data: null, error: { message: 'boom' } });
    await expect(fetchAllPages(failing)).rejects.toMatchObject({ message: 'boom' });
  });

  it('gives up rather than looping when the range is ignored', async () => {
    // What a query missing its .range() looks like from here: a full page,
    // every time, forever.
    const stuck = () =>
      Promise.resolve({ data: Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: i })), error: null });

    await expect(fetchAllPages(stuck, { maxPages: 3 })).rejects.toThrow(/Gave up after 3 pages/);
  });
});
