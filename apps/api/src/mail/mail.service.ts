import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailProvider } from './interfaces/mail-provider.interface';
import { MailDeliveryException } from './exceptions/mail-delivery.exception';

export const MAIL_PROVIDER_TOKEN = 'MAIL_PROVIDER';

export interface ContactSubmissionData {
  senderName: string;
  senderEmail: string;
  subject: string;
  messageBody: string;
  createdAt: Date;
}

const TRANSIENT_PATTERNS = ['ECONNREFUSED', 'ETIMEDOUT', '429', '500', '502', '503', '504'];

function isTransientError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return TRANSIENT_PATTERNS.some((pattern) => message.includes(pattern));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  isConfigured: boolean = true;

  mailTo: string;
  mailFrom: string;

  constructor(
    @Inject(MAIL_PROVIDER_TOKEN) private readonly provider: MailProvider,
    private readonly configService: ConfigService,
  ) {
    this.mailTo = this.configService.get<string>('MAIL_TO') ?? '';
    this.mailFrom = this.configService.get<string>('MAIL_FROM') ?? '';
    this.checkConfig();
  }

  checkConfig() {
    const activeProvider = this.configService.get<string>('MAIL_PROVIDER') || 'resend';
    let credentialsConfigured = true;
    if (activeProvider === 'smtp') {
      credentialsConfigured = !!(
        this.configService.get<string>('SMTP_HOST') &&
        this.configService.get<string>('SMTP_USER') &&
        this.configService.get<string>('SMTP_PASS')
      );
    } else {
      credentialsConfigured = !!this.configService.get<string>('RESEND_API_KEY');
    }

    this.isConfigured = !!(this.mailTo && this.mailFrom && credentialsConfigured);

    if (!this.isConfigured) {
      this.logger.warn(
        'MailService is not fully configured: mailTo, mailFrom, or provider credentials may be missing. ' +
          'Email notifications will fail until these are set.',
      );
    }
  }

  updateConfig(mailTo?: string, mailFrom?: string) {
    if (mailTo !== undefined) this.mailTo = mailTo;
    if (mailFrom !== undefined) this.mailFrom = mailFrom;
    this.checkConfig();
  }

  async sendContactNotification(submission: ContactSubmissionData): Promise<void> {
    const { senderName, senderEmail, subject, messageBody, createdAt } = submission;
    const createdAtIso = createdAt.toISOString();

    const textBody = [
      `New contact form submission`,
      ``,
      `From:    ${senderName} <${senderEmail}>`,
      `Subject: ${subject}`,
      `Date:    ${createdAtIso}`,
      ``,
      `Message:`,
      messageBody,
    ].join('\n');

    const htmlBody = `
<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /></head>
  <body style="font-family: sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #b45309;">New Contact Form Submission</h2>
    <table style="border-collapse: collapse; width: 100%;">
      <tr>
        <td style="padding: 8px; font-weight: bold; white-space: nowrap;">From:</td>
        <td style="padding: 8px;">${escapeHtml(senderName)} &lt;<a href="mailto:${escapeHtml(senderEmail)}">${escapeHtml(senderEmail)}</a>&gt;</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold; white-space: nowrap;">Subject:</td>
        <td style="padding: 8px;">${escapeHtml(subject)}</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold; white-space: nowrap;">Date:</td>
        <td style="padding: 8px;">${escapeHtml(createdAtIso)}</td>
      </tr>
    </table>
    <hr style="margin: 16px 0;" />
    <h3 style="color: #b45309;">Message</h3>
    <p style="white-space: pre-wrap;">${escapeHtml(messageBody)}</p>
  </body>
</html>`.trim();

    const MAX_ATTEMPTS = 4; // 1 initial + 3 retries

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.provider.send({
          to: this.mailTo,
          from: this.mailFrom,
          subject: `[Contact Form] ${subject}`,
          text: textBody,
          html: htmlBody,
        });
        return; // success
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (!isTransientError(error)) {
          // Permanent error — fail immediately
          this.logger.error(`Permanent mail delivery error: ${message}`);
          throw new MailDeliveryException(`Mail delivery failed permanently: ${message}`);
        }

        // Transient error
        if (attempt < MAX_ATTEMPTS) {
          this.logger.warn(
            `Transient mail delivery error (attempt ${attempt}/${MAX_ATTEMPTS}): ${message}. Retrying in 5s...`,
          );
          await sleep(5000);
        } else {
          // All attempts exhausted
          this.logger.error(
            `Mail delivery failed after ${MAX_ATTEMPTS} attempts. Last error: ${message}`,
          );
          throw new MailDeliveryException(
            `Mail delivery failed after ${MAX_ATTEMPTS} attempts: ${message}`,
          );
        }
      }
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
