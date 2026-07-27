import { LoaderCache } from '../LoaderCache';

describe(LoaderCache, () => {
  afterEach(() => {
    delete globalThis.__EXPO_ROUTER_LOADER_DATA__;
  });

  describe('notify', () => {
    it('bumps the version and wakes subscribers', () => {
      const cache = new LoaderCache();
      const listener = jest.fn();
      cache.subscribe(listener);

      const before = cache.getSnapshot();
      cache.notify();

      expect(cache.getSnapshot()).toBe(before + 1);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear', () => {
    it('drops in-flight promises and resets the Suspense store', () => {
      const cache = new LoaderCache();
      cache.setPromise('/pending', Promise.resolve('pending'));
      cache.suspense.set('/p', { data: 'v1' });

      cache.clear();

      expect(cache.getPromise('/pending')).toBeUndefined();
      expect(cache.suspense.get('/p')).toBeUndefined();
    });
  });

  describe('invalidateAll', () => {
    it('resets the Suspense store and wakes subscribers', () => {
      const cache = new LoaderCache();
      cache.suspense.set('/p', { data: 'v1' });
      const listener = jest.fn();
      cache.subscribe(listener);
      const before = cache.getSnapshot();

      cache.invalidateAll();

      expect(cache.suspense.get('/p')).toBeUndefined();
      expect(cache.getSnapshot()).toBe(before + 1);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('consumeHydrationData', () => {
    it('lifts the server-injected value into the Suspense store and deletes the global key', () => {
      const cache = new LoaderCache();
      globalThis.__EXPO_ROUTER_LOADER_DATA__ = { '/index': { seeded: true } };

      cache.consumeHydrationData('/index');

      expect(cache.suspense.get('/index')).toEqual({ data: { seeded: true } });
      expect(globalThis.__EXPO_ROUTER_LOADER_DATA__).not.toHaveProperty('/index');
    });

    it('does not replace an existing Suspense entry (set-if-absent)', () => {
      const cache = new LoaderCache();
      cache.suspense.set('/index', { data: 'existing' });
      globalThis.__EXPO_ROUTER_LOADER_DATA__ = { '/index': 'seed' };

      cache.consumeHydrationData('/index');

      expect(cache.suspense.get('/index')).toEqual({ data: 'existing' });
    });

    it('is a no-op when no hydration data exists for the path', () => {
      const cache = new LoaderCache();
      globalThis.__EXPO_ROUTER_LOADER_DATA__ = { '/other': 'value' };

      cache.consumeHydrationData('/index');

      expect(cache.suspense.get('/index')).toBeUndefined();
      expect(globalThis.__EXPO_ROUTER_LOADER_DATA__).toHaveProperty('/other');
    });
  });
});
