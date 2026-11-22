import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SettingsService } from './settings.service';
import { UpdateFeatureSettingsDto } from './dto/update-feature-settings.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RevalidationService } from '../common/revalidation.service';

const baseRow = (over: Record<string, unknown> = {}) => ({
  isContactFormEnabled: true,
  isBlogEnabled: false,
  isGameEnabled: false,
  areCommentsEnabled: false,
  commentModerationMode: 'MANUAL',
  isCommentCaptchaEnabled: false,
  commentAutoCloseDays: 0,
  commentMaxPerPost: 100,
  commentSpamThreshold: 50,
  commentNotifyEmail: false,
  updatedAt: new Date('2026-11-07T00:00:00Z'),
  ...over,
});

describe('SettingsService isGameEnabled (QA, T-001)', () => {
  let service: SettingsService;
  let store: ReturnType<typeof baseRow>;
  let prisma: { siteSettings: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock } };
  let purge: jest.Mock;

  beforeEach(async () => {
    store = baseRow();
    prisma = {
      siteSettings: {
        findUnique: jest.fn(async () => ({ ...store })),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          store = { ...store, ...data } as ReturnType<typeof baseRow>;
          return { ...store };
        }),
        create: jest.fn(),
      },
    };
    purge = jest.fn().mockResolvedValue(undefined);
    const mod = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: MailService, useValue: { updateConfig: jest.fn(), isConfigured: false } },
        { provide: RevalidationService, useValue: { purge } },
      ],
    }).compile();
    service = mod.get(SettingsService);
  });

  it('AC-DUEL-015.1: update with isGameEnabled true is stored, public settings return true, settings tag purged', async () => {
    // warm the cache with the old value so a missing invalidation would show up
    expect((await service.getPublicSettings()).isGameEnabled).toBe(false);

    const res = await service.updateFeatureSettings({ isGameEnabled: true });

    expect(prisma.siteSettings.update.mock.calls[0][0].data).toEqual({ isGameEnabled: true });
    expect(res.isGameEnabled).toBe(true);
    expect((await service.getPublicSettings()).isGameEnabled).toBe(true);
    expect((await service.getFeatureSettings()).isGameEnabled).toBe(true);
    expect(purge).toHaveBeenCalledWith(['settings']);
  });

  it('AC-DUEL-015.1: turning game off again works and purges', async () => {
    await service.updateFeatureSettings({ isGameEnabled: true });
    await service.updateFeatureSettings({ isGameEnabled: false });
    expect((await service.getPublicSettings()).isGameEnabled).toBe(false);
    expect(purge).toHaveBeenCalledTimes(2);
  });

  it.each(['yes', 1, 'true', {}])(
    'AC-DUEL-015.2: isGameEnabled %p is rejected by DTO validation (400 via ValidationPipe)',
    async (bad) => {
      const errors = await validate(plainToInstance(UpdateFeatureSettingsDto, { isGameEnabled: bad }));
      expect(errors.map((e) => e.property)).toContain('isGameEnabled');
    },
  );

  it('AC-DUEL-015.2: valid booleans pass validation', async () => {
    for (const v of [true, false]) {
      const errors = await validate(plainToInstance(UpdateFeatureSettingsDto, { isGameEnabled: v }));
      expect(errors).toHaveLength(0);
    }
  });

  it('AC-DUEL-015.3: an update without isGameEnabled keeps the stored value', async () => {
    store = baseRow({ isGameEnabled: true });
    const res = await service.updateFeatureSettings({ isBlogEnabled: true });

    expect(prisma.siteSettings.update.mock.calls[0][0].data).not.toHaveProperty('isGameEnabled');
    expect(res.isGameEnabled).toBe(true);
    expect((await service.getPublicSettings()).isGameEnabled).toBe(true);
  });

  it('AC-DUEL-015.3: turning blog off does not touch isGameEnabled', async () => {
    store = baseRow({ isGameEnabled: true, isBlogEnabled: true });
    await service.updateFeatureSettings({ isBlogEnabled: false });
    expect(store.isGameEnabled).toBe(true);
  });
});
