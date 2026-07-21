import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { SiteSettingsDto, UpdateSiteSettingsDto, MailStatusDto } from '@jazz-portfolio/shared';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly SETTINGS_ID = 'default';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
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
      },
    });
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
    if (dto.isContactFormEnabled !== undefined) data.isContactFormEnabled = dto.isContactFormEnabled;
    if (dto.mailProvider !== undefined) data.mailProvider = dto.mailProvider;
    if (dto.mailFrom !== undefined) data.mailFrom = dto.mailFrom;
    if (dto.mailTo !== undefined) data.mailTo = dto.mailTo;

    const row = await this.prisma.siteSettings.update({
      where: { id: this.SETTINGS_ID },
      data,
    });

    this.mailService.updateConfig(row.mailTo, row.mailFrom);

    return {
      id: row.id,
      isContactFormEnabled: row.isContactFormEnabled,
      mailProvider: row.mailProvider,
      mailFrom: row.mailFrom,
      mailTo: row.mailTo,
      updatedAt: row.updatedAt.toISOString(),
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

  async getPublicSettings(): Promise<{ isContactFormEnabled: boolean }> {
    const settings = await this.getSettings();
    return {
      isContactFormEnabled: settings.isContactFormEnabled,
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
