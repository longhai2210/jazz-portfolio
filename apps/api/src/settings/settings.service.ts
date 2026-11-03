import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RevalidationService } from '../common/revalidation.service';
import {
  SiteSettingsDto,
  UpdateSiteSettingsDto,
  MailStatusDto,
  FeatureSettingsDto,
  UpdateFeatureSettingsDto,
  FeatureSettingsStatusDto,
  PublicSettingsDto,
  CommentModerationMode,
} from '@jazz-portfolio/shared';

export interface CachedSiteSettings {
  isContactFormEnabled: boolean;
  isBlogEnabled: boolean;
  areCommentsEnabled: boolean;
  commentModerationMode: string;
  isCommentCaptchaEnabled: boolean;
  commentAutoCloseDays: number;
  commentMaxPerPost: number;
  commentSpamThreshold: number;
  commentNotifyEmail: boolean;
}

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly SETTINGS_ID = 'default';
  private cachedSettings: CachedSiteSettings | null = null;
  private cacheExpiresAt = 0;
  private cacheLoadPromise: Promise<CachedSiteSettings> | null = null;
  private cacheVersion = 0;
  private readonly CACHE_TTL_MS = 30_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly revalidationService: RevalidationService,
  ) {}

  async onModuleInit() {
    try {
      await this.ensureSettingsSeeded();
      const settings = await this.getSettings();
      this.mailService.updateConfig(settings.mailTo, settings.mailFrom);
    } catch (err) {
      console.error('Failed to initialize MailService configuration from database settings:', err);
    }
  }

  /** Seed a single SiteSettings row once at boot — never upsert on every read. */
  private async ensureSettingsSeeded(): Promise<void> {
    const existing = await this.prisma.siteSettings.findUnique({
      where: { id: this.SETTINGS_ID },
    });
    if (existing) return;

    await this.prisma.siteSettings.create({
      data: {
        id: this.SETTINGS_ID,
        isContactFormEnabled: true,
        mailProvider: this.configService.get<string>('MAIL_PROVIDER') || 'resend',
        mailFrom: this.configService.get<string>('MAIL_FROM') || '',
        mailTo: this.configService.get<string>('MAIL_TO') || '',
        isBlogEnabled: false,
        areCommentsEnabled: false,
        commentModerationMode: 'ALL',
        isCommentCaptchaEnabled: false,
        commentAutoCloseDays: 0,
        commentMaxPerPost: 500,
        commentSpamThreshold: 60,
        commentNotifyEmail: true,
      },
    });
  }

  /** Clear in-process cache synchronously when settings change. */
  invalidateCache(): void {
    this.cachedSettings = null;
    this.cacheExpiresAt = 0;
    this.cacheLoadPromise = null;
    this.cacheVersion += 1;
  }

  /** Fast in-process cached read (30s TTL) for FeatureFlagGuard. */
  async getCachedSettings(): Promise<CachedSiteSettings> {
    const now = Date.now();
    if (this.cachedSettings && now < this.cacheExpiresAt) {
      return this.cachedSettings;
    }

    // Collapse concurrent guard/public requests when the short TTL expires.
    // Without this, a burst can issue one identical database query per request.
    if (this.cacheLoadPromise) {
      return this.cacheLoadPromise;
    }

    const loadVersion = this.cacheVersion;
    const loadPromise = (async () => {
      const row = await this.prisma.siteSettings.findUnique({
        where: { id: this.SETTINGS_ID },
        select: {
          isContactFormEnabled: true,
          isBlogEnabled: true,
          areCommentsEnabled: true,
          commentModerationMode: true,
          isCommentCaptchaEnabled: true,
          commentAutoCloseDays: true,
          commentMaxPerPost: true,
          commentSpamThreshold: true,
          commentNotifyEmail: true,
        },
      });

      if (!row) {
        throw new NotFoundException('Site settings are not initialized');
      }

      const cached: CachedSiteSettings = { ...row };
      if (loadVersion === this.cacheVersion) {
        this.cachedSettings = cached;
        this.cacheExpiresAt = Date.now() + this.CACHE_TTL_MS;
      }
      return cached;
    })();

    this.cacheLoadPromise = loadPromise;
    try {
      return await loadPromise;
    } finally {
      if (this.cacheLoadPromise === loadPromise) {
        this.cacheLoadPromise = null;
      }
    }
  }

  async getSettings(): Promise<SiteSettingsDto> {
    const row = await this.prisma.siteSettings.findUnique({
      where: { id: this.SETTINGS_ID },
    });

    if (!row) {
      throw new NotFoundException('Site settings are not initialized');
    }

    return {
      id: row.id,
      isContactFormEnabled: row.isContactFormEnabled,
      mailProvider: row.mailProvider,
      mailFrom: row.mailFrom,
      mailTo: row.mailTo,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateSettings(dto: UpdateSiteSettingsDto): Promise<SiteSettingsDto> {
    const data: Record<string, unknown> = {};
    if (dto.isContactFormEnabled !== undefined)
      data.isContactFormEnabled = dto.isContactFormEnabled;
    if (dto.mailProvider !== undefined) data.mailProvider = dto.mailProvider;
    if (dto.mailFrom !== undefined) data.mailFrom = dto.mailFrom;
    if (dto.mailTo !== undefined) data.mailTo = dto.mailTo;

    const row = await this.prisma.siteSettings.update({
      where: { id: this.SETTINGS_ID },
      data,
    });

    this.invalidateCache();
    this.mailService.updateConfig(row.mailTo, row.mailFrom);
    void this.revalidationService.purge(['settings']);

    return {
      id: row.id,
      isContactFormEnabled: row.isContactFormEnabled,
      mailProvider: row.mailProvider,
      mailFrom: row.mailFrom,
      mailTo: row.mailTo,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getFeatureSettings(): Promise<FeatureSettingsDto> {
    const row = await this.prisma.siteSettings.findUnique({
      where: { id: this.SETTINGS_ID },
    });

    if (!row) {
      throw new NotFoundException('Site settings are not initialized');
    }

    return {
      isBlogEnabled: row.isBlogEnabled,
      areCommentsEnabled: row.areCommentsEnabled,
      commentModerationMode: row.commentModerationMode as CommentModerationMode,
      isCommentCaptchaEnabled: row.isCommentCaptchaEnabled,
      commentAutoCloseDays: row.commentAutoCloseDays,
      commentMaxPerPost: row.commentMaxPerPost,
      commentSpamThreshold: row.commentSpamThreshold,
      commentNotifyEmail: row.commentNotifyEmail,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateFeatureSettings(dto: UpdateFeatureSettingsDto): Promise<FeatureSettingsDto> {
    const data: Record<string, unknown> = {};

    // Guardrail: turning blog off force-sends areCommentsEnabled: false
    const isBlogOff = dto.isBlogEnabled === false;

    if (dto.isBlogEnabled !== undefined) data.isBlogEnabled = dto.isBlogEnabled;
    if (isBlogOff) {
      data.areCommentsEnabled = false;
    } else if (dto.areCommentsEnabled !== undefined) {
      data.areCommentsEnabled = dto.areCommentsEnabled;
    }

    if (dto.commentModerationMode !== undefined)
      data.commentModerationMode = dto.commentModerationMode;
    if (dto.isCommentCaptchaEnabled !== undefined)
      data.isCommentCaptchaEnabled = dto.isCommentCaptchaEnabled;
    if (dto.commentAutoCloseDays !== undefined)
      data.commentAutoCloseDays = dto.commentAutoCloseDays;
    if (dto.commentMaxPerPost !== undefined) data.commentMaxPerPost = dto.commentMaxPerPost;
    if (dto.commentSpamThreshold !== undefined)
      data.commentSpamThreshold = dto.commentSpamThreshold;
    if (dto.commentNotifyEmail !== undefined) data.commentNotifyEmail = dto.commentNotifyEmail;

    const row = await this.prisma.siteSettings.update({
      where: { id: this.SETTINGS_ID },
      data,
    });

    this.invalidateCache();

    // Trigger Next.js cache revalidation for settings tag (fire-and-forget)
    void this.revalidationService.purge(['settings']);

    return {
      isBlogEnabled: row.isBlogEnabled,
      areCommentsEnabled: row.areCommentsEnabled,
      commentModerationMode: row.commentModerationMode as CommentModerationMode,
      isCommentCaptchaEnabled: row.isCommentCaptchaEnabled,
      commentAutoCloseDays: row.commentAutoCloseDays,
      commentMaxPerPost: row.commentMaxPerPost,
      commentSpamThreshold: row.commentSpamThreshold,
      commentNotifyEmail: row.commentNotifyEmail,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getFeatureStatus(): Promise<FeatureSettingsStatusDto> {
    const pendingCommentCount = await this.prisma.comment.count({
      where: { status: 'PENDING', isDeleted: false },
    });

    return {
      captchaConfigured: !!this.configService.get<string>('TURNSTILE_SECRET_KEY'),
      tokenSecretConfigured: !!this.configService.get<string>('COMMENT_TOKEN_SECRET'),
      ipSaltConfigured: !!this.configService.get<string>('COMMENT_IP_HASH_SALT'),
      pendingCommentCount,
    };
  }

  getMailStatus(): MailStatusDto {
    const provider = this.configService.get<string>('MAIL_PROVIDER') || 'resend';
    const hasApiKey = !!this.configService.get<string>('RESEND_API_KEY');
    const hasSmtpCredentials = !!(
      this.configService.get<string>('SMTP_HOST') &&
      this.configService.get<string>('SMTP_USER') &&
      this.configService.get<string>('SMTP_PASS')
    );

    return {
      provider,
      isConfigured: this.mailService.isConfigured,
      hasApiKey,
      hasSmtpCredentials,
    };
  }

  async getPublicSettings(): Promise<PublicSettingsDto> {
    const cached = await this.getCachedSettings();
    return {
      isContactFormEnabled: cached.isContactFormEnabled,
      isBlogEnabled: cached.isBlogEnabled,
      areCommentsEnabled: cached.areCommentsEnabled,
      isCommentCaptchaEnabled: cached.isCommentCaptchaEnabled,
    };
  }

  async sendTestEmail(): Promise<boolean> {
    const settings = await this.getSettings();
    if (!this.mailService.isConfigured) {
      throw new Error('MailService is not configured. Cannot send test email.');
    }

    await this.mailService.sendContactNotification({
      senderName: 'Jazzfolio Test Mailer',
      senderEmail: settings.mailFrom || 'test@example.com',
      subject: 'Test Email Notification',
      messageBody: `This is a test notification to verify your Jazzfolio email settings are correctly configured.\n\nProvider: ${settings.mailProvider}\nSender (From): ${settings.mailFrom}\nRecipient (To): ${settings.mailTo}\nTime Sent: ${new Date().toISOString()}`,
      createdAt: new Date(),
    });

    return true;
  }
}
