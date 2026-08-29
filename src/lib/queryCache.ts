/**
 * A minimal cache with in-flight de-duplication.
 *
 * The Insights section has five sibling tabs, and each ran its own query for
 * the same thing: every workout in the range with its nested exercises and
 * set logs. Switching tabs refetched the lot, and nothing was shared — so the
 * cost was paid five times over for one answer.
 *
 * This is deliberately not a data-layer library. It does the two things that
 * actually hurt here — never fetch the same key twice concurrently, and reuse
 * a recent result — and nothing else. A real cache (TanStack Query) is the
 * right answer when the app grows a proper data layer (EZ-15); until then,
 * pulling one in to fix one screen would be more disruption than the problem
 * warrants.
 */

interface Entry<T> {
  value?: T;
  storedAt?: number;
  /** Present while a fetch is in flight, so concurrent callers share it. */
  inFlight?: Promise<T>;
}

export interface CacheOptions {
  /** How long a result stays fresh. Defaults to 5 minutes. */
  ttlMs?: number;
  now?: () => number;
}

export function createQueryCache<T>({ ttlMs = 5 * 60_000, now = Date.now }: CacheOptions = {}) {
  const entries = new Map<string, Entry<T>>();

  function isFresh(entry: Entry<T>): boolean {
    return entry.storedAt !== undefined && now() - entry.storedAt < ttlMs;
  }

  /**
   * Return the cached value for `key`, or run `fetcher` to produce it.
   *
   * Concurrent calls for the same key share one fetch. That is the property
   * that matters here: five tabs mounting at once must not become five
   * identical requests.
   */
  async function get(key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = entries.get(key);

    if (existing?.inFlight) return existing.inFlight;
    if (existing && isFresh(existing) && existing.value !== undefined) return existing.value;

    const inFlight = fetcher()
      .then((value) => {
        entries.set(key, { value, storedAt: now() });
        return value;
      })
      .catch((error) => {
        // Drop the failed entry so the next caller retries rather than
        // inheriting a rejected promise forever.
        entries.delete(key);
        throw error;
      });

    entries.set(key, { ...existing, inFlight });
    return inFlight;
  }

  /** Drop one key, or everything. Call after a write that invalidates a read. */
  function invalidate(key?: string): void {
    if (key === undefined) entries.clear();
    else entries.delete(key);
  }

  return { get, invalidate, size: () => entries.size };
}
