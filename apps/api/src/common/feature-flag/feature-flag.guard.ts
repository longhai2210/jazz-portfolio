import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SettingsService } from '../../settings/settings.service';
import { FEATURE_KEY, FeatureMeta } from './require-feature.decorator';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly settingsService: SettingsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<FeatureMeta>(FEATURE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!meta) return true;

    const s = await this.settingsService.getCachedSettings();

    let enabled = false;

    if (meta.feature === 'blog') {
      enabled = s.isBlogEnabled;
    } else if (meta.feature === 'comments') {
      enabled =
        s.isBlogEnabled &&
        s.areCommentsEnabled &&
        s.commentModerationMode !== 'CLOSED';
    } else if (meta.feature === 'contact') {
      enabled = s.isContactFormEnabled;
    }

    if (enabled) return true;

    if (meta.notFoundWhenOff) {
      throw new NotFoundException('Not Found');
    }

    throw new ForbiddenException(`FEATURE_DISABLED:${meta.feature}`);
  }
}
