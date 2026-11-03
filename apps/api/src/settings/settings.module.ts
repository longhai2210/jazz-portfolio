import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { RevalidationService } from '../common/revalidation.service';

@Module({
  imports: [PrismaModule, MailModule, ConfigModule],
  controllers: [SettingsController],
  providers: [SettingsService, RevalidationService],
  exports: [SettingsService, RevalidationService],
})
export class SettingsModule {}
