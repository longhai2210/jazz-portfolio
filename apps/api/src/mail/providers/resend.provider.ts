import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { MailProvider, MailSendOptions } from '../interfaces/mail-provider.interface';

@Injectable()
export class ResendProvider implements MailProvider {
  private readonly logger = new Logger(ResendProvider.name);
  private readonly resend: Resend;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');

    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    this.resend = new Resend(apiKey);
  }

  async send(options: MailSendOptions): Promise<void> {
    const { error } = await this.resend.emails.send({
      to: options.to,
      from: options.from,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    if (error) {
      this.logger.error(`Resend delivery failed: ${error.message}`);
      throw new Error(`Resend delivery failed: ${error.message}`);
    }
  }
}
