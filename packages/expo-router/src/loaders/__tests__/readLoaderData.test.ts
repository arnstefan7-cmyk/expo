import { LoaderCache } from '../LoaderCache';
import { readLoaderData } from '../readLoaderData';

const tick = () => Promise.resolve();

describe(readLoaderData, () => {
  it('fetches once, then reuses the value across re-renders', async () => {
    const cache = new LoaderCache();
    const fetcher = jest.fn(async () => 'v1');

    const pending = readLoaderData(cache, '/p', fetcher);
    expect(pending).toBeInstanceOf(Promise);
    await pending;

    for (let i = 0; i < 5; i++) {
      expect(readLoaderData(cache, '/p', fetcher)).toBe('v1');
    }
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('fetches again on a fresh mount after the Suspense entry is reclaimed', async () => {
    const cache = new LoaderCache();
    const fetcher = jest
      .fn<Promise<string>, [string]>()
      .mockResolvedValueOnce('v1')
      .mockResolvedValueOnce('v2');

    await readLoaderData(cache, '/p', fetcher);
    expect(readLoaderData(cache, '/p', fetcher)).toBe('v1');

    cache.suspense.retain('/p');
    cache.suspense.release('/p');
    await tick();
    expect(cache.suspense.get('/p')).toBeUndefined();

    const revisit = readLoaderData(cache, '/p', fetcher);
    expect(revisit).toBeInstanceOf(Promise);
    await expect(revisit).resolves.toBe('v2');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('fetches exactly once when Suspense replays a cache-miss mount', () => {
    const cache = new LoaderCache();
    const fetcher = jest.fn(async () => 'v1');

    const first = readLoaderData(cache, '/p', fetcher);
    const second = readLoaderData(cache, '/p', fetcher);

    expect(first).toBeInstanceOf(Promise);
    expect(second).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('throws the settled error to every read in the same render pass without refetching', async () => {
    const cache = new LoaderCache();
    const fetcherError = new Error('boom');
    const fetcher = jest.fn(async () => {
      throw fetcherError;
    });

    const pending = readLoaderData(cache, '/err', fetcher);
    await expect(pending).rejects.toThrow('Failed to load loader data for route: /err');

    expect(() => readLoaderData(cache, '/err', fetcher)).toThrow(
      'Failed to load loader data for route: /err'
    );
    expect(() => readLoaderData(cache, '/err', fetcher)).toThrow(
      'Failed to load loader data for route: /err'
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('clears the error entry after the render pass so a retry re-render refetches', async () => {
    const cache = new LoaderCache();
    const fetcher = jest
      .fn<Promise<string>, [string]>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('recovered');

    await expect(readLoaderData(cache, '/err', fetcher)).rejects.toThrow(
      'Failed to load loader data for route: /err'
    );
    expect(() => readLoaderData(cache, '/err', fetcher)).toThrow(
      'Failed to load loader data for route: /err'
    );

    await tick();
    expect(cache.suspense.get('/err')).toBeUndefined();

    const retry = readLoaderData(cache, '/err', fetcher);
    expect(retry).toBeInstanceOf(Promise);
    await expect(retry).resolves.toBe('recovered');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not double-fetch across a StrictMode unmount + remount within the same tick', async () => {
    const cache = new LoaderCache();
    const fetcher = jest.fn(async () => 'v1');

    await readLoaderData(cache, '/sm', fetcher);
    cache.suspense.retain('/sm');
    cache.suspense.release('/sm');
    cache.suspense.retain('/sm');
    await tick();

    expect(readLoaderData(cache, '/sm', fetcher)).toBe('v1');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not re-seed a reclaimed entry when an abandoned fetch resolves', async () => {
    const cache = new LoaderCache();
    let resolveFetch!: (value: string) => void;
    const fetcher = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFetch = resolve;
        })
    );

    const abandoned = readLoaderData(cache, '/p', fetcher) as Promise<string>;
    cache.suspense.retain('/p');
    cache.suspense.release('/p');
    await tick();
    expect(cache.suspense.get('/p')).toBeUndefined();

    resolveFetch('stale');
    await expect(abandoned).resolves.toBe('stale');
    expect(cache.suspense.get('/p')).toBeUndefined();

    expect(readLoaderData(cache, '/p', fetcher)).toBeInstanceOf(Promise);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not re-seed a reclaimed entry when an abandoned fetch rejects', async () => {
    const cache = new LoaderCache();
    let rejectFetch!: (error: Error) => void;
    const fetcher = jest.fn(
      () =>
        new Promise<string>((_, reject) => {
          rejectFetch = reject;
        })
    );

    const abandoned = readLoaderData(cache, '/err', fetcher) as Promise<string>;
    cache.suspense.retain('/err');
    cache.suspense.release('/err');
    await tick();
    expect(cache.suspense.get('/err')).toBeUndefined();

    rejectFetch(new Error('boom'));
    await expect(abandoned).rejects.toThrow('Failed to load loader data for route: /err');
    expect(cache.suspense.get('/err')).toBeUndefined();

    expect(readLoaderData(cache, '/err', fetcher)).toBeInstanceOf(Promise);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not re-seed after invalidateAll when an in-flight fetch resolves', async () => {
    const cache = new LoaderCache();
    let resolveFetch!: (value: string) => void;
    const fetcher = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFetch = resolve;
        })
    );

    const inFlight = readLoaderData(cache, '/p', fetcher) as Promise<string>;
    cache.invalidateAll();

    resolveFetch('pre-edit');
    await expect(inFlight).resolves.toBe('pre-edit');
    expect(cache.suspense.get('/p')).toBeUndefined();
  });
});
