import { ADMIN_SESSION_MARKER_COOKIE } from '@jazz-portfolio/shared';

/** UX-only marker on the Next.js host for middleware; Nest JWT is the real session. */
export function setAdminSessionMarker(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${ADMIN_SESSION_MARKER_COOKIE}=1; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24}`;
}

export function clearAdminSessionMarker(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${ADMIN_SESSION_MARKER_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
}
