/**
 * Reading more rows than PostgREST will hand over at once.
 *
 * A Supabase select returns at most the server's `max-rows` — 1,000 by default
 * — and says nothing about it. No error, no flag, no count: just a short array
 * that looks exactly like the whole answer. Every aggregate built on an
 * unpaged select is therefore silently computed from a slice, and the wrongness
 * grows with the history.
 *
 * That is EZ-35, found in the template export, where "recent performance" was
 * drawn from the oldest 1,000 of 1,650 rows and reported June as the last time
 * anything was lifted. The same query shape was in three Insights hooks, whose
 * windows are all past the cap: muscle balance and strength trend at 180 days,
 * stall detection at 200. Those screens are the ones that say where training
 * volume is short, so the truncation was not cosmetic — it was shaping
 * decisions about what to train.
 *
 * The fix is boring and belongs in one place: ask for an explicit range, keep
 * asking until a page comes back short.
 */

/** What one page of a Supabase select resolves to. */
export interface Page<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/** Rows per request. Matches PostgREST's default `max-rows`. */
export const PAGE_SIZE = 1000;

/**
 * Read every row a query matches, a page at a time.
 *
 * `fetchPage` is handed an inclusive range and must apply it with `.range()`
 * **and** a stable order. Stable means a tiebreak beyond the sort column:
 * rows written in the same second are ordinary here — a set finished and the
 * next started — and two rows that compare equal can swap places between
 * requests, which returns one of them twice and never returns the other.
 *
 * Stops on the first short page. A full last page costs one extra empty
 * request, which is the cheap half of the trade: the alternative is stopping
 * early on a total that happens to divide by the page size.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<Page<T>>,
  { pageSize = PAGE_SIZE, maxPages = 50 } = {},
): Promise<T[]> {
  const rows: T[] = [];

  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const { data, error } = await fetchPage(from, from + pageSize - 1);

    if (error) throw error;

    const batch = data ?? [];
    rows.push(...batch);

    if (batch.length < pageSize) return rows;
  }

  // A guard rather than a condition anyone should hit: 50 pages is 50,000 rows,
  // far past any plausible amount of training history. Reaching it means the
  // range is not advancing — a query without `.range()` applied, say — and
  // looping forever would be a hung screen with no explanation.
  throw new Error(
    `Gave up after ${maxPages} pages (${maxPages * pageSize} rows). The query is probably not applying its range.`,
  );
}
