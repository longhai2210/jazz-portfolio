export const SUPPORTED_LOCALES = ['en', 'vi', 'ja'] as const;
export const DEFAULT_LOCALE = 'en';

export const API_VERSION = 'v1';

/** httpOnly JWT cookie set by Nest on login (API host). */
export const AUTH_COOKIE_NAME = 'jazz_access_token';

/**
 * Non-httpOnly UX marker on the Next.js host so middleware can gate /admin/*.
 * Real authorization is always the Nest JWT cookie + JwtAuthGuard.
 */
export const ADMIN_SESSION_MARKER_COOKIE = 'jazz_admin_session';

export const FILE_SIZE_LIMITS = {
  IMAGE_MAX_BYTES: 5 * 1024 * 1024,     // 5MB
  AUDIO_MAX_BYTES: 50 * 1024 * 1024,    // 50MB
} as const;

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac'] as const;
