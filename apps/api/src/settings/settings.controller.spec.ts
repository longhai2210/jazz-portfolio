import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { UpdateFeatureSettingsDto } from './dto/update-feature-settings.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RevalidationService } from '../common/revalidation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const initialRow = {
  id: 'default',
  isContactFormEnabled: true,
  mailProvider: 'resend',
  mailFrom: '',
  mailTo: '',
  isBlogEnabled: false,
  isGameEnabled: false,
  areCommentsEnabled: false,
  commentModerationMode: 'ALL',
  isCommentCaptchaEnabled: false,
  commentAutoCloseDays: 0,
  commentMaxPerPost: 500,
  commentSpamThreshold: 60,
  commentNotifyEmail: true,
  updatedAt: new Date('2026-11-07T00:00:00Z'),
};

describe('SettingsController feature switches', () => {
  let controller: SettingsController;
  let row: typeof initialRow;
  let siteSettings: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
  let revalidationService: { purge: jest.Mock };

  // Same options as the global pipe in main.ts, so the body is checked as in production.
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const bodyMeta: ArgumentMetadata = { type: 'body', metatype: UpdateFeatureSettingsDto, data: '' };

  /** PUT /settings/admin/features: global validation pipe, then the controller handler. */
  const putFeatures = async (body: Record<string, unknown>) =>
    controller.updateFeatureSettings(await pipe.transform(body, bodyMeta));

  beforeEach(async () => {
    row = { ...initialRow };
    siteSettings = {
      findUnique: jest.fn(async (args: { select?: Record<string, boolean> }) => {
        if (!args.select) return { ...row };
        return Object.fromEntries(
          Object.keys(args.select).map((key) => [key, row[key as keyof typeof row]]),
        );
      }),
      update: jest.fn(async (args: { data: Partial<typeof initialRow> }) => {
        row = { ...row, ...args.data };
        return { ...row };
      }),
      create: jest.fn(),
    };
    revalidationService = { purge: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        SettingsService,
        {
          provide: PrismaService,
          useValue: { siteSettings, comment: { count: jest.fn().mockResolvedValue(0) } },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: MailService, useValue: { updateConfig: jest.fn(), isConfigured: false } },
        { provide: RevalidationService, useValue: revalidationService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SettingsController>(SettingsController);
  });

  it('AC-DUEL-015.1: PUT admin/features with isGameEnabled true is accepted and GET public returns true', async () => {
    expect((await controller.getPublicSettings()).isGameEnabled).toBe(false);

    const saved = await putFeatures({ isGameEnabled: true });

    expect(saved.isGameEnabled).toBe(true);
    expect(revalidationService.purge).toHaveBeenCalledWith(['settings']);
    expect((await controller.getPublicSettings()).isGameEnabled).toBe(true);
    expect((await controller.getFeatureSettings()).settings.isGameEnabled).toBe(true);
  });

  it('AC-DUEL-015.2: isGameEnabled "yes" is rejected with 400 and the stored value is unchanged', async () => {
    const error = await putFeatures({ isGameEnabled: 'yes' }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BadRequestException);
    const badRequest = error as BadRequestException;
    expect(badRequest.getStatus()).toBe(400);
    expect(badRequest.getResponse()).toMatchObject({
      message: ['isGameEnabled must be a boolean value'],
    });
    expect(siteSettings.update).not.toHaveBeenCalled();
    expect(revalidationService.purge).not.toHaveBeenCalled();
    expect((await controller.getPublicSettings()).isGameEnabled).toBe(false);
  });

  it('AC-DUEL-015.2: a body with an invalid isGameEnabled saves none of its other fields', async () => {
    const error = await putFeatures({ isGameEnabled: 'yes', isBlogEnabled: true }).catch(
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(BadRequestException);
    expect(siteSettings.update).not.toHaveBeenCalled();
    expect(await controller.getPublicSettings()).toMatchObject({
      isBlogEnabled: false,
      isGameEnabled: false,
    });
  });
});
