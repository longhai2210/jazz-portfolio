import { ApiRoutes } from '@jazz-portfolio/shared';

const getMock = jest.fn();

jest.mock('@/lib/api-public', () => ({
  CACHE_TAGS: {
    profile: 'profile',
    categories: 'categories',
    settings: 'settings',
    music: 'music',
  },
  PublicApiClient: {
    get: (...args: unknown[]) => getMock(...args),
  },
}));

describe('portfolio-data getProfile', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    getMock.mockReset();
    jest.resetModules();
  });

  afterAll(() => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, writable: true });
  });

  it('fetches the public profile route with the profile cache tag', async () => {
    getMock.mockResolvedValue({
      data: { id: 'p1', displayName: { en: 'Jazz', vi: 'Jazz', ja: 'Jazz' } },
      meta: null,
    });

    const { getProfile } = await import('@/lib/portfolio-data');
    const profile = await getProfile();

    expect(getMock).toHaveBeenCalledWith(ApiRoutes.profile.public(), {
      tags: ['profile'],
    });
    expect(profile).toMatchObject({ id: 'p1' });
  });
});
