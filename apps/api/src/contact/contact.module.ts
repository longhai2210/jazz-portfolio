import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';
import { FeatureFlagModule } from '../common/feature-flag/feature-flag.module';

@Module({
  imports: [PrismaModule, MailModule, ThrottlerModule, FeatureFlagModule],
  controllers: [ContactController],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
