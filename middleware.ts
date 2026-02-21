import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const TEAM_ACCESS_KEY = 'richniggers';
const TEAM_ACCESS_COOKIE = 'team_session_access';

// Routes that should bypass the coming soon check
const BYPASS_ROUTES = [
  '/coming-soon',
  '/api/',
  '/_next/',
  '/favicon.ico',
];

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Check if route should bypass coming soon
  const shouldBypass = BYPASS_ROUTES.some(route => pathname.startsWith(route));

  if (!shouldBypass) {
    // Check for access query parameter
    const accessParam = searchParams.get('access');

    if (accessParam === TEAM_ACCESS_KEY) {
      // Set cookie and redirect to clean URL (remove query param)
      const cleanUrl = new URL(pathname, request.url);
      const response = NextResponse.redirect(cleanUrl);
      response.cookies.set(TEAM_ACCESS_COOKIE, 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60, // 15 minutes — must re-enter access code after expiry
      });
      // Delete the old persistent cookie so it doesn't grant access
      response.cookies.delete('team_access');
      return response;
    }

    // Check for existing team access cookie
    const hasTeamAccess = request.cookies.get(TEAM_ACCESS_COOKIE)?.value === 'true';

    if (!hasTeamAccess) {
      // Redirect to coming soon page
      const comingSoonUrl = new URL('/coming-soon', request.url);
      const response = NextResponse.redirect(comingSoonUrl);
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      return response;
    }
  }

  // Continue with session update for authenticated routes
  const response = await updateSession(request)
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
