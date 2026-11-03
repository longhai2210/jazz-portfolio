import { Module } from '@nestjs/common';
import { SettingsModule } from '../../settings/settings.module';
import { FeatureFlagGuard } from './feature-flag.guard';

@Module({
  imports: [SettingsModule],
  providers: [FeatureFlagGuard],
  exports: [FeatureFlagGuard, SettingsModule],
})
export class FeatureFlagModule {}
