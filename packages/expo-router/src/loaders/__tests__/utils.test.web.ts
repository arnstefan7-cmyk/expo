import { bustDevLoaderCache, fetchLoader, getLoaderModulePath } from '../utils';

describe(getLoaderModulePath, () => {
  it('converts root path to /_expo/loaders/index', () => {
    expect(getLoaderModulePath('/')).toBe('/_expo/loaders/index');
  });

  it('converts paths without trailing slash', () => {
    expect(getLoaderModulePath('/about')).toBe('/_expo/loaders/about');
  });

  it('strips trailing slashes', () => {
    expect(getLoaderModulePath('/about/')).toBe('/_expo/loaders/about');
  });

  it('handles nested paths', () => {
    expect(getLoaderModulePath('/posts/123')).toBe('/_expo/loaders/posts/123');
  });

  it('preserves route groups in paths', () => {
    expect(getLoaderModulePath('/(group)/index')).toBe('/_expo/loaders/(group)/index');
  });

  it('preserves query parameters', () => {
    expect(getLoaderModulePath('/request?foo=bar')).toBe('/_expo/loaders/request?foo=bar');
  });

  it('preserves query parameters on root path', () => {
    expect(getLoaderModulePath('/?foo=bar')).toBe('/_expo/loaders/index?foo=bar');
  });

  it('preserves multiple query parameters', () => {
    expect(getLoaderModulePath('/request?a=1&b=2')).toBe('/_expo/loaders/request?a=1&b=2');
  });

  it('preserves query parameters with trailing slash', () => {
    expect(getLoaderModulePath('/about/?foo=bar')).toBe('/_expo/loaders/about?foo=bar');
  });
});

describe(fetchLoader, () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({ ok: true }),
        }) as unknown as Response
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function fetchedUrl(): string {
    return (global.fetch as jest.Mock).mock.calls[0][0];
  }

  // These tests run in order: the revision is module state that only ever increments.
  it('fetches the plain loader URL before any dev invalidation', async () => {
    await fetchLoader('/about');

    expect(fetchedUrl()).toBe('/_expo/loaders/about');
  });

  it('appends a cache-busting revision to loader URLs after a dev invalidation', async () => {
    bustDevLoaderCache();

    await fetchLoader('/about');

    expect(fetchedUrl()).toMatch(/^\/_expo\/loaders\/about\?_expo_loader_v=\d+$/);
  });

  it('appends the revision after existing query parameters', async () => {
    await fetchLoader('/request?foo=bar');

    expect(fetchedUrl()).toMatch(/^\/_expo\/loaders\/request\?foo=bar&_expo_loader_v=\d+$/);
  });

  it('changes the revision on each subsequent invalidation', async () => {
    await fetchLoader('/about');
    const firstUrl = fetchedUrl();

    bustDevLoaderCache();
    (global.fetch as jest.Mock).mockClear();
    await fetchLoader('/about');

    expect(fetchedUrl()).not.toBe(firstUrl);
  });
});
