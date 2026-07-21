import { cache } from 'react';
import {
  ApiRoutes,
  ProfileDto,
  CategoryDto,
  TrackDto,
} from '@jazz-portfolio/shared';
import { CACHE_TAGS, PublicApiClient } from '@/lib/api-public';

/**
 * Deduplicated public portfolio fetches for RSC.
 * Layout + page both call `getProfile` in one request — React `cache()` collapses them.
 */

export const getProfile = cache(async (): Promise<ProfileDto | null> => {
  try {
    const res = await PublicApiClient.get<ProfileDto>(ApiRoutes.profile.public(), {
      tags: [CACHE_TAGS.profile],
    });
    if (res.data) return res.data;
  } catch (error) {
    console.warn('Could not fetch profile from API:', error);
  }

  if (process.env.NODE_ENV === 'development') {
    const { MOCK_PROFILE } = await import('@/lib/mocks/portfolio');
    return MOCK_PROFILE;
  }

  return null;
});

export const getCategories = cache(async (): Promise<CategoryDto[]> => {
  try {
    const res = await PublicApiClient.get<CategoryDto[]>(ApiRoutes.categories.public(), {
      tags: [CACHE_TAGS.categories],
    });
    if (res.data && res.data.length > 0) return res.data;
  } catch (error) {
    console.warn('Could not fetch categories from API:', error);
  }

  if (process.env.NODE_ENV === 'development') {
    const { MOCK_CATEGORIES } = await import('@/lib/mocks/portfolio');
    return MOCK_CATEGORIES;
  }

  return [];
});

export const getPublicSettings = cache(
  async (): Promise<{ isContactFormEnabled: boolean }> => {
    try {
      const res = await PublicApiClient.get<{ isContactFormEnabled: boolean }>(
        ApiRoutes.settings.public(),
        { tags: [CACHE_TAGS.settings] },
      );
      if (res.data) return res.data;
    } catch (error) {
      console.warn('Could not fetch settings from API:', error);
    }

    return { isContactFormEnabled: true };
  },
);

export const getMusicTracks = cache(async (): Promise<TrackDto[] | null> => {
  try {
    const res = await PublicApiClient.get<TrackDto[]>(ApiRoutes.music.public(), {
      tags: [CACHE_TAGS.music],
    });
    if (res.data) return res.data;
  } catch (error) {
    console.warn('Could not fetch music from API:', error);
  }
  return null;
});
