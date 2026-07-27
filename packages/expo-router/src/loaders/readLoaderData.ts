import type { LoaderCache } from './LoaderCache';

type LoaderFetcher<T> = (path: string) => Promise<T>;

/**
 * Read for `useLoaderData`. The per-mount Suspense store ensures a re-render returns the settled
 * value, error, or in-flight promise. A fresh mount fetches so the platform HTTP cache decides
 * freshness.
 */
export function readLoaderData<T>(
  cache: LoaderCache,
  resolvedPath: string,
  fetcher: LoaderFetcher<T>
): T | Promise<T> {
  const suspended = cache.suspense.get<T>(resolvedPath);
  if (suspended instanceof Promise) {
    return suspended;
  }
  if (suspended) {
    if ('error' in suspended) {
      cache.suspense.expireError(resolvedPath);
      throw suspended.error;
    }
    return suspended.data;
  }

  // The settled result is published only while this fetch still owns the entry — an entry
  // reclaimed on unmount or reset by invalidation must stay empty so the next mount fetches.
  const promise: Promise<T> = fetchIntoCache(cache, resolvedPath, fetcher).then(
    (data) => {
      if (cache.suspense.get(resolvedPath) === promise) {
        cache.suspense.set(resolvedPath, { data });
      }
      return data;
    },
    (error) => {
      if (cache.suspense.get(resolvedPath) === promise) {
        cache.suspense.set(resolvedPath, { error });
      }
      throw error;
    }
  );
  cache.suspense.set(resolvedPath, promise);
  return promise;
}

function fetchIntoCache<T>(
  cache: LoaderCache,
  path: string,
  fetcher: LoaderFetcher<T>
): Promise<T> {
  const inFlight = cache.getPromise<T>(path);
  if (inFlight) {
    return inFlight;
  }

  const promise = fetcher(path)
    .then((data) => {
      cache.deletePromise(path);
      return data;
    })
    .catch((error) => {
      cache.deletePromise(path);
      throw new Error(`Failed to load loader data for route: ${path}`, {
        cause: error,
      });
    });

  cache.setPromise(path, promise);
  return promise;
}
