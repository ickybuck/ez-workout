import { describe, it, expect, vi } from 'vitest';
import { createQueryCache } from './queryCache';

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('in-flight de-duplication', () => {
  it('runs one fetch for concurrent callers of the same key', async () => {
    // The property that matters: five Insights tabs mounting at once must not
    // become five identical full-history requests.
    const cache = createQueryCache<string>();
    const fetcher = vi.fn(async () => 'value');

    const results = await Promise.all([
      cache.get('k', fetcher),
      cache.get('k', fetcher),
      cache.get('k', fetcher),
      cache.get('k', fetcher),
      cache.get('k', fetcher),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['value', 'value', 'value', 'value', 'value']);
  });

  it('does not share between different keys', async () => {
    const cache = createQueryCache<string>();
    const fetcher = vi.fn(async () => 'v');
    await Promise.all([cache.get('30', fetcher), cache.get('90', fetcher)]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('shares a fetch that is still pending when the second caller arrives', async () => {
    const cache = createQueryCache<string>();
    const d = deferred<string>();
    const fetcher = vi.fn(() => d.promise);

    const first = cache.get('k', fetcher);
    const second = cache.get('k', fetcher);
    d.resolve('done');

    expect(await first).toBe('done');
    expect(await second).toBe('done');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('caching', () => {
  it('reuses a fresh result without refetching', async () => {
    const cache = createQueryCache<string>({ ttlMs: 1000, now: () => 0 });
    const fetcher = vi.fn(async () => 'v');

    await cache.get('k', fetcher);
    await cache.get('k', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refetches once the result goes stale', async () => {
    let clock = 0;
    const cache = createQueryCache<string>({ ttlMs: 1000, now: () => clock });
    const fetcher = vi.fn(async () => 'v');

    await cache.get('k', fetcher);
    clock = 1001;
    await cache.get('k', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('drops the entry on failure so the next caller retries', async () => {
    // A rejected promise left in the cache would poison the key forever.
    const cache = createQueryCache<string>();
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce('recovered');

    await expect(cache.get('k', fetcher)).rejects.toThrow('network');
    await expect(cache.get('k', fetcher)).resolves.toBe('recovered');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('invalidate', () => {
  it('forces a refetch for one key', async () => {
    const cache = createQueryCache<string>({ now: () => 0 });
    const fetcher = vi.fn(async () => 'v');

    await cache.get('k', fetcher);
    cache.invalidate('k');
    await cache.get('k', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('clears everything when called with no key', async () => {
    const cache = createQueryCache<string>({ now: () => 0 });
    const fetcher = vi.fn(async () => 'v');

    await Promise.all([cache.get('a', fetcher), cache.get('b', fetcher)]);
    cache.invalidate();

    expect(cache.size()).toBe(0);
  });
});
