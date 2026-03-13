import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const TEAM_ACCESS_KEY = process.env.TEAM_ACCESS_KEY;
const TEAM_ACCESS_COOKIE = "team_session_access";

// Routes that should bypass the coming soon check
const BYPASS_ROUTES = ["/coming-soon", "/api/", "/_next/", "/favicon.ico"];

// Routes that should skip middleware entirely (external webhooks, server-to-server)
const SKIP_MIDDLEWARE_ROUTES = ["/api/payments/keepz/callback"];

/** Constant-time string comparison safe for Edge Runtime (no Node.js crypto).
 *  Pads both inputs to the same length to avoid leaking length information. */
function timingSafeCompare(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);
  const maxLen = Math.max(aBuf.length, bBuf.length);
  let mismatch = aBuf.length !== bBuf.length ? 1 : 0;
  for (let i = 0; i < maxLen; i++) {
    mismatch |= (aBuf[i] ?? 0) ^ (bBuf[i] ?? 0);
  }
  return mismatch === 0;
}

export async function middleware(request: NextRequest) {
  // CSP-01: Generate per-request nonce for inline script allowlisting
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  request.headers.set("x-nonce", nonce);

  const { pathname, searchParams } = request.nextUrl;

  // Skip middleware entirely for external webhooks (no auth processing, no CSP)
  if (SKIP_MIDDLEWARE_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if route should bypass coming soon
  const shouldBypass = BYPASS_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  if (!shouldBypass) {
    // Check for access query parameter
    const accessParam = searchParams.get("access");

    if (
      TEAM_ACCESS_KEY &&
      accessParam &&
      timingSafeCompare(accessParam, TEAM_ACCESS_KEY)
    ) {
      // Set cookie and redirect to clean URL (remove query param)
      const cleanUrl = new URL(pathname, request.url);
      const response = NextResponse.redirect(cleanUrl);
      response.cookies.set(TEAM_ACCESS_COOKIE, "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60, // 15 minutes — must re-enter access code after expiry
      });
      // Delete the old persistent cookie so it doesn't grant access
      response.cookies.delete("team_access");
      return response;
    }

    // Check for existing team access cookie
    const hasTeamAccess =
      request.cookies.get(TEAM_ACCESS_COOKIE)?.value === "true";

    if (!hasTeamAccess) {
      // Redirect to coming soon page
      const comingSoonUrl = new URL("/coming-soon", request.url);
      const response = NextResponse.redirect(comingSoonUrl);
      response.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate",
      );
      response.headers.set("Pragma", "no-cache");
      return response;
    }
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
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://api.keepz.me https://app.posthog.com https://us.i.posthog.com",
    "frame-src 'self' https://checkout.keepz.me",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
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
