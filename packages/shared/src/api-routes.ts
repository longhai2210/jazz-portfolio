/**
 * Nest API path builders + request/response contracts for admin ops.
 * Nest controllers are the source of truth; the web app must use these helpers.
 */

// === Shared request / response types ===

export type MediaUploadContext = 'PROFILE' | 'CATEGORY' | 'TRACK' | 'GENERAL';

export interface PresignUploadRequest {
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  context: MediaUploadContext;
}

export interface PresignUploadResponse {
  uploadUrl: string;
  cloudfrontUrl: string;
  s3Key: string;
}

export interface ReorderRequest {
  ids: string[];
}

export interface ReorderResponse {
  success: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface CreateTrackRequest {
  title: string;
  artist: string;
  s3Key: string;
  cloudfrontUrl: string;
  durationSeconds: number;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateTrackRequest {
  title?: string;
  artist?: string;
  s3Key?: string;
  cloudfrontUrl?: string;
  durationSeconds?: number;
  sortOrder?: number;
  isActive?: boolean;
}

/** Swap two adjacent items and return the full ordered id list for PATCH reorder. */
export function buildReorderIds(
  orderedIds: string[],
  index: number,
  direction: 'up' | 'down',
): string[] | null {
  const targetIdx = direction === 'up' ? index - 1 : index + 1;
  if (targetIdx < 0 || targetIdx >= orderedIds.length) return null;
  const next = [...orderedIds];
  [next[index], next[targetIdx]] = [next[targetIdx], next[index]];
  return next;
}

// === Path builders (Nest-aligned) ===

export const ApiRoutes = {
  auth: {
    login: () => '/auth/login',
    logout: () => '/auth/logout',
    me: () => '/auth/me',
  },

  profile: {
    public: () => '/profile',
    adminUpdate: () => '/profile/admin/update',
    adminPassword: () => '/profile/admin/password',
  },

  categories: {
    public: () => '/categories',
    bySlug: (slug: string) => `/categories/${slug}`,
    adminAll: () => '/categories/admin/all',
    adminCreate: () => '/categories/admin/create',
    adminUpdate: (id: string) => `/categories/admin/${id}`,
    adminDelete: (id: string) => `/categories/admin/${id}`,
    adminReorder: () => '/categories/admin/reorder',
    adminCreateItem: (categoryId: string) => `/categories/admin/${categoryId}/items`,
    adminUpdateItem: (id: string) => `/categories/admin/items/${id}`,
    adminDeleteItem: (id: string) => `/categories/admin/items/${id}`,
    adminReorderItems: () => '/categories/admin/items/reorder',
  },

  music: {
    public: () => '/music',
    adminAll: () => '/music/admin/all',
    adminCreate: () => '/music/admin/create',
    adminUpdate: (id: string) => `/music/admin/${id}`,
    adminDelete: (id: string) => `/music/admin/${id}`,
    adminReorder: () => '/music/admin/reorder',
  },

  media: {
    adminPresign: () => '/media/admin/presign',
    adminAll: () => '/media/admin/all',
  },

  settings: {
    public: () => '/settings/public',
    adminEmail: () => '/settings/admin/email',
    adminEmailTest: () => '/settings/admin/email/test',
  },

  contact: {
    submit: () => '/contact',
    adminList: (page?: number, limit?: number) => {
      const params = new URLSearchParams();
      if (page != null) params.set('page', String(page));
      if (limit != null) params.set('limit', String(limit));
      const qs = params.toString();
      return qs ? `/admin/contact?${qs}` : '/admin/contact';
    },
    adminGet: (id: string) => `/admin/contact/${id}`,
    adminMarkRead: (id: string) => `/admin/contact/${id}/read`,
  },

  admin: {
    stats: () => '/admin/stats',
  },
} as const;
