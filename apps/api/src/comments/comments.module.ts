import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { FeatureFlagModule } from '../common/feature-flag/feature-flag.module';
import { CommentsController } from './comments.controller';
import { CommentsAdminController } from './comments-admin.controller';
import { CommentsService } from './comments.service';
import { SpamShieldService } from './spam-shield.service';

@Module({
  imports: [PrismaModule, SettingsModule, FeatureFlagModule, ConfigModule],
  controllers: [CommentsController, CommentsAdminController],
  providers: [CommentsService, SpamShieldService],
  exports: [CommentsService],
})
export class CommentsModule {}
