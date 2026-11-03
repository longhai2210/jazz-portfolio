import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type PublicCacheTag = 'profile' | 'categories' | 'settings' | 'music' | 'posts' | 'comments';

@Injectable()
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name);

  constructor(private readonly configService: ConfigService) {}

  async purge(tags: PublicCacheTag[]): Promise<void> {
    const url = this.configService.get<string>('WEB_REVALIDATE_URL');
    const secret = this.configService.get<string>('REVALIDATE_SECRET');

    if (!url || !secret) {
      // no-op in local dev if not configured
      return;
    }

    const results = await Promise.allSettled(
      tags.map(async (tag) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-revalidate-secret': secret,
          },
          body: JSON.stringify({ tag }),
          signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) {
          throw new Error(`tag ${tag}: HTTP ${response.status}`);
        }
      }),
    );

    const failures = results.flatMap((result) =>
      result.status === 'rejected' ? [String(result.reason)] : [],
    );
    if (failures.length > 0) {
      this.logger.warn(`Cache revalidation failed: ${failures.join('; ')}`);
    }
  }
}
