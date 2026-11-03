import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_MARKER_COOKIE } from '@jazz-portfolio/shared';
import { routing } from '@/i18n/routing';

const intlMiddleware = createMiddleware(routing);

/**
 * Gate /admin/* (except login) using a UX session marker cookie on the Next host.
 * The Nest JWT lives on the API host as httpOnly `jazz_access_token` and cannot be
 * read here cross-origin — layout still verifies via GET /auth/me.
 */
export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const adminMatch = pathname.match(/^\/(en|vi|ja)\/admin(\/.*)?$/);

  if (adminMatch) {
    const rest = adminMatch[2] ?? '';
    const isLogin = rest === '/login' || rest.startsWith('/login/');
    const hasSession = request.cookies.has(ADMIN_SESSION_MARKER_COOKIE);

    if (!isLogin && !hasSession) {
      const locale = adminMatch[1];
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = `/${locale}/admin/login`;
      const response = NextResponse.redirect(loginUrl);
      response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
      return response;
    }
  }

  const response = intlMiddleware(request);
  if (adminMatch) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  return response;
}

export const config = {
  matcher: ['/', '/(en|vi|ja)/:path*'],
};
