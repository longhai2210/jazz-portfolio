import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { FeatureFlagModule } from '../common/feature-flag/feature-flag.module';
import { BlogController } from './blog.controller';
import { BlogAdminController } from './blog-admin.controller';
import { BlogService } from './blog.service';

@Module({
  imports: [PrismaModule, SettingsModule, FeatureFlagModule, ConfigModule],
  controllers: [BlogController, BlogAdminController],
  providers: [BlogService],
  exports: [BlogService],
})
export class BlogModule {}
