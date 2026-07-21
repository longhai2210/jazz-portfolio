import { ApiResponse } from '@jazz-portfolio/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/**
 * Next.js Data Cache tags for public portfolio GETs.
 * Invalidate via POST /api/revalidate with `{ "tag": "<name>" }` after CMS mutations.
 */
export const CACHE_TAGS = {
  profile: 'profile',
  categories: 'categories',
  settings: 'settings',
  music: 'music',
} as const;

export type PublicCacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

export type PublicGetOptions = {
  /** Cache tags for `revalidateTag` (default: none). */
  tags?: PublicCacheTag[];
  /** ISR seconds; default 60. Pass `false` to opt out of time-based revalidation. */
  revalidate?: number | false;
};

/** RSC-safe public GETs — uses Next Data Cache (`revalidate` + tags). */
export class PublicApiClient {
  static async get<T>(
    path: string,
    options: PublicGetOptions = {},
  ): Promise<ApiResponse<T>> {
    const revalidate = options.revalidate ?? 60;
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      next: {
        revalidate,
        ...(options.tags?.length ? { tags: options.tags } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`GET ${path} failed: ${response.statusText}`);
    }

    return response.json();
  }

  static async post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`POST ${path} failed: ${response.statusText}`);
    }

    return response.json();
  }
}
