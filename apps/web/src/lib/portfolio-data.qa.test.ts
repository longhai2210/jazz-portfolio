import { ApiRoutes } from '@jazz-portfolio/shared';

const getMock = jest.fn();

jest.mock('@/lib/api-public', () => ({
  CACHE_TAGS: { profile: 'profile', categories: 'categories', settings: 'settings', music: 'music' },
}));

jest.mock('@/lib/api-public-server', () => ({
  ServerPublicApiClient: { get: (...args: unknown[]) => getMock(...args) },
}));

describe('getPublicSettings isGameEnabled (QA, T-001)', () => {
  beforeEach(() => {
    getMock.mockReset();
    jest.resetModules();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('AC-DUEL-015.4: fallback has isGameEnabled false when the API call rejects', async () => {
    getMock.mockRejectedValue(new Error('network down'));
    const { getPublicSettings } = await import('@/lib/portfolio-data');
    const s = await getPublicSettings();
    expect(getMock).toHaveBeenCalledWith(ApiRoutes.settings.public(), { tags: ['settings'] });
    expect(s.isGameEnabled).toBe(false);
  });

  it('AC-DUEL-015.4: fallback has isGameEnabled false when the API returns empty data', async () => {
    getMock.mockResolvedValue({ data: null, meta: null });
    const { getPublicSettings } = await import('@/lib/portfolio-data');
    expect((await getPublicSettings()).isGameEnabled).toBe(false);
  });

  it('AC-DUEL-015.4: a real API value of true is passed through, not overridden by the fallback', async () => {
    getMock.mockResolvedValue({
      data: {
        isContactFormEnabled: true,
        isBlogEnabled: false,
        isGameEnabled: true,
        areCommentsEnabled: false,
        isCommentCaptchaEnabled: false,
      },
      meta: null,
    });
    const { getPublicSettings } = await import('@/lib/portfolio-data');
    expect((await getPublicSettings()).isGameEnabled).toBe(true);
  });
});
