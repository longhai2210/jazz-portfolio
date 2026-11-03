import type { ApiResponse } from '@jazz-portfolio/shared';
import { parseApiResponse } from '@/lib/api-response';

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
  posts: 'posts',
  comments: 'comments',
} as const;

export type PublicCacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/**
 * Browser-facing public API client for interactive reads and writes.
 *
 * Cached RSC reads live in `api-public-server.ts`. Keeping these clients
 * separate prevents browser requests (comment tokens/reloads) from inheriting
 * Next.js Data Cache options and lets the server use a private API origin.
 */
export class PublicApiClient {
  static async get<T>(path: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    return parseApiResponse<T>(response, 'GET', path);
  }

  static async post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    return parseApiResponse<T>(response, 'POST', path);
  }
}
