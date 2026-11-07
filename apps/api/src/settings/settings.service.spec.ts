import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RevalidationService } from '../common/revalidation.service';

type SettingsRow = {
  id: string;
  isContactFormEnabled: boolean;
  mailProvider: string;
  mailFrom: string;
  mailTo: string;
  isBlogEnabled: boolean;
  isGameEnabled: boolean;
  areCommentsEnabled: boolean;
  commentModerationMode: string;
  isCommentCaptchaEnabled: boolean;
  commentAutoCloseDays: number;
  commentMaxPerPost: number;
  commentSpamThreshold: number;
  commentNotifyEmail: boolean;
  updatedAt: Date;
};

const baseRow: SettingsRow = {
  id: 'default',
  isContactFormEnabled: true,
  mailProvider: 'resend',
  mailFrom: '',
  mailTo: '',
  isBlogEnabled: true,
  isGameEnabled: false,
  areCommentsEnabled: true,
  commentModerationMode: 'ALL',
  isCommentCaptchaEnabled: false,
  commentAutoCloseDays: 0,
  commentMaxPerPost: 500,
  commentSpamThreshold: 60,
  commentNotifyEmail: true,
  updatedAt: new Date('2026-11-07T00:00:00Z'),
};

/**
 * In-memory stand-in for the single site_settings row. `findUnique` honours `select`,
 * so a field missing from the service's select is missing from what it reads back.
 */
function createSettingsTable(initial: SettingsRow) {
  let row: SettingsRow = { ...initial };
  return {
    findUnique: jest.fn(async (args: { select?: Record<string, boolean> }) => {
      if (!args.select) return { ...row };
      const picked: Record<string, unknown> = {};
      for (const [key, on] of Object.entries(args.select)) {
        if (on) picked[key] = row[key as keyof SettingsRow];
      }
      return picked;
    }),
    update: jest.fn(async (args: { data: Partial<SettingsRow> }) => {
      row = { ...row, ...args.data, updatedAt: new Date('2026-11-07T01:00:00Z') };
      return { ...row };
    }),
    create: jest.fn(),
    current: () => ({ ...row }),
  };
}

describe('SettingsService', () => {
  let service: SettingsService;
  let siteSettings: ReturnType<typeof createSettingsTable>;
  let revalidationService: jest.Mocked<RevalidationService>;

  const build = async (initial: SettingsRow) => {
    siteSettings = createSettingsTable(initial);
    revalidationService = {
      purge: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RevalidationService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: { siteSettings } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: MailService, useValue: { updateConfig: jest.fn(), isConfigured: false } },
        { provide: RevalidationService, useValue: revalidationService },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  };

  describe('isGameEnabled switch', () => {
    it('AC-DUEL-015.1: saving isGameEnabled true purges the settings tag and the public settings return true', async () => {
      await build({ ...baseRow, isGameEnabled: false });

      // Prime the in-process cache with the old value.
      expect((await service.getPublicSettings()).isGameEnabled).toBe(false);

      const saved = await service.updateFeatureSettings({ isGameEnabled: true });

      expect(siteSettings.update).toHaveBeenCalledWith({
        where: { id: 'default' },
        data: { isGameEnabled: true },
      });
      expect(saved.isGameEnabled).toBe(true);
      expect(revalidationService.purge).toHaveBeenCalledWith(['settings']);

      const publicSettings = await service.getPublicSettings();
      expect(publicSettings.isGameEnabled).toBe(true);
      expect((await service.getFeatureSettings()).isGameEnabled).toBe(true);
    });

    it('AC-DUEL-015.1: switching the game on does not change the blog or comment switches', async () => {
      await build({ ...baseRow, isBlogEnabled: true, areCommentsEnabled: true });

      await service.updateFeatureSettings({ isGameEnabled: true });

      expect(await service.getPublicSettings()).toEqual({
        isContactFormEnabled: true,
        isBlogEnabled: true,
        isGameEnabled: true,
        areCommentsEnabled: true,
        isCommentCaptchaEnabled: false,
      });
    });

    it('AC-DUEL-015.3: an update without isGameEnabled keeps the stored value', async () => {
      await build({ ...baseRow, isGameEnabled: true });

      const saved = await service.updateFeatureSettings({ commentMaxPerPost: 200 });

      const { data } = siteSettings.update.mock.calls[0][0];
      expect(data).not.toHaveProperty('isGameEnabled');
      expect(saved.isGameEnabled).toBe(true);
      expect(siteSettings.current().isGameEnabled).toBe(true);
      expect((await service.getPublicSettings()).isGameEnabled).toBe(true);
    });

    it('AC-DUEL-015.3: turning the blog off keeps the stored isGameEnabled', async () => {
      await build({ ...baseRow, isBlogEnabled: true, isGameEnabled: true });

      const saved = await service.updateFeatureSettings({ isBlogEnabled: false });

      const { data } = siteSettings.update.mock.calls[0][0];
      expect(data).toEqual({ isBlogEnabled: false, areCommentsEnabled: false });
      expect(saved.isGameEnabled).toBe(true);
      expect((await service.getPublicSettings()).isGameEnabled).toBe(true);
    });
  });
});
