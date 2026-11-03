import { cache } from 'react';
import {
  ApiRoutes,
  PaginatedResponse,
  PostDetailDto,
  PostListItemDto,
} from '@jazz-portfolio/shared';
import { CACHE_TAGS } from '@/lib/api-public';
import { ServerPublicApiClient } from '@/lib/api-public-server';

export const getPublicPosts = cache(
  async (
    page = 1,
    limit = 10,
    tag?: string,
  ): Promise<PaginatedResponse<PostListItemDto> | null> => {
    try {
      const res = await ServerPublicApiClient.get<PaginatedResponse<PostListItemDto>>(
        ApiRoutes.blog.publicList({ page, limit, tag }),
        { tags: [CACHE_TAGS.posts] },
      );
      if (res.data) return res.data;
    } catch (error) {
      console.warn('Could not fetch posts from API:', error);
    }
    return null;
  },
);

export const getPublicPostBySlug = cache(
  async (slug: string): Promise<PostDetailDto | null> => {
    try {
      const res = await ServerPublicApiClient.get<PostDetailDto>(
        ApiRoutes.blog.publicBySlug(slug),
        { tags: [CACHE_TAGS.posts] },
      );
      if (res.data) return res.data;
    } catch (error) {
      console.warn(`Could not fetch post "${slug}" from API:`, error);
    }
    return null;
  },
);

export const getPublicTags = cache(
  async (): Promise<{ tag: string; count: number }[]> => {
    try {
      const res = await ServerPublicApiClient.get<{ tag: string; count: number }[]>(
        ApiRoutes.blog.publicTags(),
        { tags: [CACHE_TAGS.posts] },
      );
      if (res.data) return res.data;
    } catch (error) {
      console.warn('Could not fetch tags from API:', error);
    }
    return [];
  },
);
