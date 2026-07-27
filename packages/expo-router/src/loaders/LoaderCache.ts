/**
 * Copyright © 2026 650 Industries.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { createContext } from 'react';

import { LoaderSuspenseStore } from './LoaderSuspenseStore';
import { bustDevLoaderCache } from './utils';

export class LoaderCache {
  private promises = new Map<string, Promise<unknown>>();
  private version = 0;
  private listeners = new Set<() => void>();

  readonly suspense = new LoaderSuspenseStore();

  // Arrow-bound so `loaderCache.subscribe` returns a stable reference across renders,
  // which keeps `useSyncExternalStore()` from tearing down and re-attaching every render.
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): number => {
    return this.version;
  };

  notify() {
    this.version++;
    for (const listener of this.listeners) {
      listener();
    }
  }

  invalidateAll() {
    this.clear();
    this.notify();
  }

  getPromise<T = unknown>(path: string): Promise<T> | undefined {
    return this.promises.get(path) as Promise<T> | undefined;
  }

  setPromise(path: string, promise: Promise<unknown>) {
    this.promises.set(path, promise);
  }

  deletePromise(path: string) {
    this.promises.delete(path);
  }

  /**
   * Lift a server-injected value into the keyed Suspense store and consume the global entry.
   * The store write is idempotent so render replay and Strict Mode remounts keep the same value.
   */
  consumeHydrationData(path: string) {
    const hydrationData = globalThis.__EXPO_ROUTER_LOADER_DATA__;
    if (!hydrationData || !Object.prototype.hasOwnProperty.call(hydrationData, path)) {
      return;
    }

    this.suspense.seed(path, hydrationData[path]);
    delete hydrationData[path];
  }

  clear() {
    this.promises.clear();
    this.suspense.reset();
  }
}

export const defaultLoaderCache = new LoaderCache();
export const LoaderCacheContext = createContext<LoaderCache>(defaultLoaderCache);

// On `loader-invalidate`, drop any unconsumed server-injected data and refetch loaders fresh.
if (__DEV__ && typeof window !== 'undefined') {
  globalThis.__EXPO_LOADER_INVALIDATE_LISTENERS__ ??= [];

  if (!globalThis.__EXPO_LOADER_INVALIDATE_LISTENER_REGISTERED__) {
    globalThis.__EXPO_LOADER_INVALIDATE_LISTENER_REGISTERED__ = true;
    globalThis.__EXPO_LOADER_INVALIDATE_LISTENERS__.push(() => {
      delete globalThis.__EXPO_ROUTER_LOADER_DATA__;
      bustDevLoaderCache();
      defaultLoaderCache.invalidateAll();
    });
  }
}
