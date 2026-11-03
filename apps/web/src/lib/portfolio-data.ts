import { cache } from 'react';
import {
  ApiRoutes,
  ProfileDto,
  CategoryDto,
  TrackDto,
  PublicSettingsDto,
} from '@jazz-portfolio/shared';
import { CACHE_TAGS } from '@/lib/api-public';
import { ServerPublicApiClient } from '@/lib/api-public-server';

/**
 * Deduplicated public portfolio fetches for RSC.
 * Layout + page both call `getProfile` in one request — React `cache()` collapses them.
 */

export const getProfile = cache(async (): Promise<ProfileDto | null> => {
  try {
    const res = await ServerPublicApiClient.get<ProfileDto>(ApiRoutes.profile.public(), {
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
    const res = await ServerPublicApiClient.get<CategoryDto[]>(ApiRoutes.categories.public(), {
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
  async (): Promise<PublicSettingsDto> => {
    try {
      const res = await ServerPublicApiClient.get<PublicSettingsDto>(
        ApiRoutes.settings.public(),
        { tags: [CACHE_TAGS.settings] },
      );
      if (res.data) return res.data;
    } catch (error) {
      console.warn('Could not fetch settings from API:', error);
    }

    return {
      isContactFormEnabled: true,
      isBlogEnabled: false,
      areCommentsEnabled: false,
      isCommentCaptchaEnabled: false,
    };
  },
);

export const getMusicTracks = cache(async (): Promise<TrackDto[] | null> => {
  try {
    const res = await ServerPublicApiClient.get<TrackDto[]>(ApiRoutes.music.public(), {
      tags: [CACHE_TAGS.music],
    });
    if (res.data) return res.data;
  } catch (error) {
    console.warn('Could not fetch music from API:', error);
  }
  return null;
});
