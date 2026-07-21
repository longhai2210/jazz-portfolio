import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { validate } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { CategoriesModule } from './categories/categories.module';
import { MusicModule } from './music/music.module';
import { MediaModule } from './media/media.module';
import { ContactModule } from './contact/contact.module';
import { SettingsModule } from './settings/settings.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    PrismaModule,
    AuthModule,
    ProfileModule,
    CategoriesModule,
    MusicModule,
    MediaModule,
    ContactModule,
    SettingsModule,
    StatsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}



