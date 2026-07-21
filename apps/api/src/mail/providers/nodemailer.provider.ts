import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailProvider, MailSendOptions } from '../interfaces/mail-provider.interface';

@Injectable()
export class NodemailerProvider implements MailProvider {
  private readonly logger = new Logger(NodemailerProvider.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT') ?? 587;
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  async send(options: MailSendOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        to: options.to,
        from: options.from,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Nodemailer delivery failed: ${message}`);
      throw new Error(`Nodemailer delivery failed: ${message}`);
    }
  }
}
