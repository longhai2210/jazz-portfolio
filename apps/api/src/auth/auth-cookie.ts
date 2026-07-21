import { CookieOptions } from 'express';
import { AUTH_COOKIE_NAME } from '@jazz-portfolio/shared';

export { AUTH_COOKIE_NAME };

export type CookieSameSite = 'lax' | 'strict' | 'none';

/**
 * Cross-origin web (e.g. :3000) → API (:3001) needs SameSite=None + Secure
 * so the browser sends the cookie on credentialed fetches.
 *
 * Env:
 * - COOKIE_SAME_SITE: 'none' | 'lax' | 'strict' (default: 'none')
 * - COOKIE_SECURE: 'true' | 'false' (default: true when SameSite=none, else NODE_ENV===production)
 */
export function resolveCookieSameSite(): CookieSameSite {
  const raw = (process.env.COOKIE_SAME_SITE || 'none').toLowerCase();
  if (raw === 'lax' || raw === 'strict' || raw === 'none') {
    return raw;
  }
  return 'none';
}

export function resolveCookieSecure(sameSite: CookieSameSite): boolean {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  if (sameSite === 'none') return true;
  return process.env.NODE_ENV === 'production';
}

/** Parse JWT_EXPIRATION-like values (e.g. 24h, 60m, 3600s, bare seconds) into ms. */
export function jwtExpirationToMs(expiration: string | undefined, fallbackMs = 24 * 60 * 60 * 1000): number {
  if (!expiration) return fallbackMs;
  const trimmed = expiration.trim();
  const match = /^(\d+)([smhd])?$/i.exec(trimmed);
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * (multipliers[unit] ?? 1000);
}

export function buildAuthCookieOptions(maxAgeMs?: number): CookieOptions {
  const sameSite = resolveCookieSameSite();
  const secure = resolveCookieSecure(sameSite);

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: maxAgeMs ?? jwtExpirationToMs(process.env.JWT_EXPIRATION),
  };
}

export function buildClearAuthCookieOptions(): CookieOptions {
  const { maxAge: _maxAge, ...options } = buildAuthCookieOptions();
  return options;
}
