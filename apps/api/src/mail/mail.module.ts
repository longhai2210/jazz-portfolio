import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService, MAIL_PROVIDER_TOKEN } from './mail.service';
import { ResendProvider } from './providers/resend.provider';
import { NodemailerProvider } from './providers/nodemailer.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MAIL_PROVIDER_TOKEN,
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>('MAIL_PROVIDER');
        if (provider === 'smtp') {
          return new NodemailerProvider(configService);
        }
        // Default to resend
        return new ResendProvider(configService);
      },
      inject: [ConfigService],
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
