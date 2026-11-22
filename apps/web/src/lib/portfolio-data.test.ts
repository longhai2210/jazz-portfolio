import { ApiRoutes } from '@jazz-portfolio/shared';

const getMock = jest.fn();

jest.mock('@/lib/api-public', () => ({
  CACHE_TAGS: {
    profile: 'profile',
    categories: 'categories',
    settings: 'settings',
    music: 'music',
  },
}));

jest.mock('@/lib/api-public-server', () => ({
  ServerPublicApiClient: {
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

describe('portfolio-data getPublicSettings fallback', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    getMock.mockReset();
    jest.resetModules();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('AC-DUEL-015.4: returns isGameEnabled false when the settings API cannot be reached', async () => {
    getMock.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const { getPublicSettings } = await import('@/lib/portfolio-data');
    const settings = await getPublicSettings();

    expect(getMock).toHaveBeenCalledWith(ApiRoutes.settings.public(), {
      tags: ['settings'],
    });
    expect(settings.isGameEnabled).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('AC-DUEL-015.4: returns isGameEnabled false when the settings API returns no data', async () => {
    getMock.mockResolvedValue({ data: null, meta: null });

    const { getPublicSettings } = await import('@/lib/portfolio-data');
    const settings = await getPublicSettings();

    expect(settings).toEqual({
      isContactFormEnabled: true,
      isBlogEnabled: false,
      isGameEnabled: false,
      areCommentsEnabled: false,
      isCommentCaptchaEnabled: false,
    });
  });
});
