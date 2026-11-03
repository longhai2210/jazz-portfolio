import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagGuard } from './feature-flag.guard';
import { CachedSiteSettings, SettingsService } from '../../settings/settings.service';

describe('FeatureFlagGuard', () => {
  let guard: FeatureFlagGuard;
  let reflector: jest.Mocked<Reflector>;
  let settingsService: jest.Mocked<SettingsService>;

  const defaultSettings: CachedSiteSettings = {
    isContactFormEnabled: true,
    isBlogEnabled: false,
    areCommentsEnabled: false,
    commentModerationMode: 'ALL',
    isCommentCaptchaEnabled: false,
    commentAutoCloseDays: 0,
    commentMaxPerPost: 500,
    commentSpamThreshold: 60,
    commentNotifyEmail: true,
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    settingsService = {
      getCachedSettings: jest.fn().mockResolvedValue(defaultSettings),
    } as any;

    guard = new FeatureFlagGuard(reflector, settingsService);
  });

  const createMockContext = (): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any);

  it('allows access when no feature flag metadata is set', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const result = await guard.canActivate(createMockContext());
    expect(result).toBe(true);
  });

  describe('blog feature', () => {
    it('throws ForbiddenException when blog is disabled and notFoundWhenOff is false', async () => {
      reflector.getAllAndOverride.mockReturnValue({ feature: 'blog', notFoundWhenOff: false });
      settingsService.getCachedSettings.mockResolvedValue({ ...defaultSettings, isBlogEnabled: false });

      await expect(guard.canActivate(createMockContext())).rejects.toThrow(
        new ForbiddenException('FEATURE_DISABLED:blog'),
      );
    });

    it('throws NotFoundException when blog is disabled and notFoundWhenOff is true', async () => {
      reflector.getAllAndOverride.mockReturnValue({ feature: 'blog', notFoundWhenOff: true });
      settingsService.getCachedSettings.mockResolvedValue({ ...defaultSettings, isBlogEnabled: false });

      await expect(guard.canActivate(createMockContext())).rejects.toThrow(NotFoundException);
    });

    it('allows access when blog is enabled', async () => {
      reflector.getAllAndOverride.mockReturnValue({ feature: 'blog', notFoundWhenOff: true });
      settingsService.getCachedSettings.mockResolvedValue({ ...defaultSettings, isBlogEnabled: true });

      const result = await guard.canActivate(createMockContext());
      expect(result).toBe(true);
    });
  });

  describe('comments feature', () => {
    it('rejects comments when blog is disabled even if comments flag is on', async () => {
      reflector.getAllAndOverride.mockReturnValue({ feature: 'comments', notFoundWhenOff: false });
      settingsService.getCachedSettings.mockResolvedValue({
        ...defaultSettings,
        isBlogEnabled: false,
        areCommentsEnabled: true,
      });

      await expect(guard.canActivate(createMockContext())).rejects.toThrow(
        new ForbiddenException('FEATURE_DISABLED:comments'),
      );
    });

    it('rejects comments when comments flag is off', async () => {
      reflector.getAllAndOverride.mockReturnValue({ feature: 'comments', notFoundWhenOff: false });
      settingsService.getCachedSettings.mockResolvedValue({
        ...defaultSettings,
        isBlogEnabled: true,
        areCommentsEnabled: false,
      });

      await expect(guard.canActivate(createMockContext())).rejects.toThrow(
        new ForbiddenException('FEATURE_DISABLED:comments'),
      );
    });

    it('rejects comments when moderationMode is CLOSED', async () => {
      reflector.getAllAndOverride.mockReturnValue({ feature: 'comments', notFoundWhenOff: false });
      settingsService.getCachedSettings.mockResolvedValue({
        ...defaultSettings,
        isBlogEnabled: true,
        areCommentsEnabled: true,
        commentModerationMode: 'CLOSED',
      });

      await expect(guard.canActivate(createMockContext())).rejects.toThrow(
        new ForbiddenException('FEATURE_DISABLED:comments'),
      );
    });

    it('allows comments when blog and comments are on and mode is ALL', async () => {
      reflector.getAllAndOverride.mockReturnValue({ feature: 'comments', notFoundWhenOff: false });
      settingsService.getCachedSettings.mockResolvedValue({
        ...defaultSettings,
        isBlogEnabled: true,
        areCommentsEnabled: true,
        commentModerationMode: 'ALL',
      });

      const result = await guard.canActivate(createMockContext());
      expect(result).toBe(true);
    });

    it('allows comments when mode is SPAM_ONLY', async () => {
      reflector.getAllAndOverride.mockReturnValue({ feature: 'comments', notFoundWhenOff: false });
      settingsService.getCachedSettings.mockResolvedValue({
        ...defaultSettings,
        isBlogEnabled: true,
        areCommentsEnabled: true,
        commentModerationMode: 'SPAM_ONLY',
      });

      const result = await guard.canActivate(createMockContext());
      expect(result).toBe(true);
    });
  });

  describe('contact feature', () => {
    it('throws ForbiddenException when contact form is disabled', async () => {
      reflector.getAllAndOverride.mockReturnValue({ feature: 'contact', notFoundWhenOff: false });
      settingsService.getCachedSettings.mockResolvedValue({
        ...defaultSettings,
        isContactFormEnabled: false,
      });

      await expect(guard.canActivate(createMockContext())).rejects.toThrow(
        new ForbiddenException('FEATURE_DISABLED:contact'),
      );
    });

    it('allows access when contact form is enabled', async () => {
      reflector.getAllAndOverride.mockReturnValue({ feature: 'contact', notFoundWhenOff: false });
      settingsService.getCachedSettings.mockResolvedValue({
        ...defaultSettings,
        isContactFormEnabled: true,
      });

      const result = await guard.canActivate(createMockContext());
      expect(result).toBe(true);
    });
  });
});
