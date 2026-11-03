import { AdminApiClient } from '@/lib/api-admin';
import { CACHE_TAGS, PublicApiClient } from '@/lib/api-public';
import { ServerPublicApiClient } from '@/lib/api-public-server';

describe('API client cache options', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('ServerPublicApiClient.get uses Next Data Cache revalidate + tags', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ok: true }, meta: null }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await ServerPublicApiClient.get('/profile', {
      tags: [CACHE_TAGS.profile],
      revalidate: 120,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit & {
      next?: { revalidate?: number; tags?: string[] };
    };
    expect(init.next).toEqual({
      revalidate: 120,
      tags: [CACHE_TAGS.profile],
    });
    expect(init.cache).toBeUndefined();
  });

  it('ServerPublicApiClient.get defaults revalidate to 60', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: null, meta: null }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await ServerPublicApiClient.get('/categories');

    const init = fetchMock.mock.calls[0][1] as RequestInit & {
      next?: { revalidate?: number };
    };
    expect(init.next?.revalidate).toBe(60);
  });

  it('PublicApiClient.get bypasses browser HTTP caches for live interactive data', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: null, meta: null }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await PublicApiClient.get('/blog/posts/example/comments');

    const init = fetchMock.mock.calls[0][1] as RequestInit & { next?: unknown };
    expect(init.cache).toBe('no-store');
    expect(init.next).toBeUndefined();
  });

  it('AdminApiClient.get always uses cache: no-store and credentials', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ok: true }, meta: null }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await AdminApiClient.get('/categories/admin/all');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.cache).toBe('no-store');
    expect(init.credentials).toBe('include');
    expect((init as { next?: unknown }).next).toBeUndefined();
  });
});
