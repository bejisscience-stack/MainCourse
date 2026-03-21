import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routes that should skip middleware entirely (external webhooks, server-to-server)
const SKIP_MIDDLEWARE_ROUTES = ["/api/payments/keepz/callback"];

export async function middleware(request: NextRequest) {
  // CSP-01: Generate per-request nonce for inline script allowlisting
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  request.headers.set("x-nonce", nonce);

  const { pathname } = request.nextUrl;

  // Skip middleware entirely for external webhooks (no auth processing, no CSP)
  if (SKIP_MIDDLEWARE_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Continue with session update for authenticated routes
  const response = await updateSession(request);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");

  // SECURITY NOTE (CSP-01): style-src 'unsafe-inline' is required for Tailwind CSS which generates
  // inline styles at runtime. Removing it breaks all Tailwind styling. This is an accepted risk because:
  // 1. CSS injection is lower impact than script injection (no code execution)
  // 2. script-src uses nonce-based allowlisting which prevents XSS script execution
  // 3. Migrating to nonce-based styles requires Tailwind config changes and is tracked as a future improvement
  // To migrate: configure Tailwind to use CSS-in-JS with nonce support, or extract all styles to external stylesheets
  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://us-assets.i.posthog.com https://connect.facebook.net`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://bvptqdmhuumjbyfnjxdt.supabase.co https://nbecbsbuerdtakxkrduw.supabase.co https://*.supabase.in https://www.facebook.com",
    "font-src 'self'",
    "media-src 'self' blob: https://*.supabase.co https://*.supabase.in",
    "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://api.keepz.me https://app.posthog.com https://us.i.posthog.com https://us-assets.i.posthog.com https://*.facebook.com https://*.facebook.net",
    "frame-src 'self' https://checkout.keepz.me https://www.youtube.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
  response.headers.set("Content-Security-Policy", cspHeader);

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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
