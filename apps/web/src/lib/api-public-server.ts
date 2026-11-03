import type { ApiResponse } from '@jazz-portfolio/shared';
import type { PublicCacheTag } from '@/lib/api-public';
import { parseApiResponse } from '@/lib/api-response';

const API_BASE_URL = (
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001/api'
).replace(/\/$/, '');

export type ServerPublicGetOptions = {
  /** Cache tags for `revalidateTag` (default: none). */
  tags?: PublicCacheTag[];
  /** ISR seconds; default 60. Pass `false` to opt out of time-based revalidation. */
  revalidate?: number | false;
};

/**
 * Server-only public reads backed by the Next.js Data Cache.
 *
 * `API_INTERNAL_URL` may point at a private service address to avoid routing
 * RSC/ISR traffic through the public CDN/load balancer. Browser code must use
 * `PublicApiClient` instead.
 */
export class ServerPublicApiClient {
  static async get<T>(path: string, options: ServerPublicGetOptions = {}): Promise<ApiResponse<T>> {
    const revalidate = options.revalidate ?? 60;
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      next: {
        revalidate,
        ...(options.tags?.length ? { tags: options.tags } : {}),
      },
    });

    return parseApiResponse<T>(response, 'GET', path);
  }
}
