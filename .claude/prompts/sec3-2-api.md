Fix 8 security issues in API routes, next.config.js, and middleware.ts. Do NOT touch any files in supabase/functions/ or supabase/migrations/.

FIX 1 — HIGH — Add rate limiting to referral validation (API-01 + AUTH-02):
- In app/api/validate-referral-code/route.ts:
  - Import referralLimiter from lib/rate-limit.ts
  - Add rate limit check at top of handler using IP from request headers
  - Remove userError?.message from the 401 response — return only { error: "Unauthorized" }
  - Pattern: const ip = request.headers.get('x-forwarded-for') || 'unknown'; const { allowed } = referralLimiter.check(ip); if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

FIX 2 — HIGH — Add rate limiting to coming-soon subscribe (API-02):
- In app/api/coming-soon/subscribe/route.ts:
  - Create a new rate limiter instance (3 requests per minute per IP) or import an existing one
  - Add rate limit check at the very top of the POST handler before any database operation
  - This is an unauthenticated endpoint — rate limiting is essential

FIX 3 — MEDIUM — Fix profile route to use user-scoped client (API-03 + AUTH-02 partial):
- In app/api/profile/route.ts:
  - GET handler (line 26): replace createServiceRoleClient(token) with createServerSupabaseClient(token)
  - PATCH handler (line 104): replace createServiceRoleClient(token) with createServerSupabaseClient(token)
  - Remove userError?.message from both 401 responses (lines 20-24 and 62-66) — return only { error: "Unauthorized" }
  - Verify the profiles table has an UPDATE RLS policy that allows auth.uid() = id (it should from existing migrations)

FIX 4 — MEDIUM — Migrate CSP from unsafe-inline to stricter policy (CSP-01):
- In next.config.js: the CSP already has unsafe-inline with a TODO comment
- For now: keep unsafe-inline for style-src (Tailwind needs it) but add a more detailed TODO for script-src
- Add nonce generation note: // Next.js 14 supports nonce via middleware. See: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
- This is a documentation/planning step — full nonce migration is a separate task

FIX 5 — MEDIUM — Add SVG upload sanitization note (CSP-02):
- In next.config.js: the comment about SVG sanitization already exists from previous fix
- No additional changes needed unless the comment is missing — verify it exists

FIX 6 — LOW — Fix timing-safe compare length leak (BIZ-02):
- In middleware.ts: update the timingSafeCompare function to pad both strings to same length before comparing
- Pattern:
  function timingSafeCompare(a: string, b: string): boolean {
    const encoder = new TextEncoder();
    const maxLen = Math.max(a.length, b.length);
    const aBuf = encoder.encode(a.padEnd(maxLen));
    const bBuf = encoder.encode(b.padEnd(maxLen));
    let mismatch = a.length !== b.length ? 1 : 0;
    for (let i = 0; i < maxLen; i++) {
      mismatch |= aBuf[i] ^ bBuf[i];
    }
    return mismatch === 0;
  }

FIX 7 — LOW — Sanitize health endpoint (DATA-02):
- In app/api/health/route.ts: replace error.message in the response with generic "Database check failed"
- Log the real error server-side: console.error('[Health] DB check failed:', error.message)
- Consider replacing the profiles table query with a simpler check if possible

FIX 8 — MEDIUM — Document in-memory rate limiting limitation (INFRA-02):
- In lib/rate-limit.ts: verify the TODO comment exists at the top of the file
- If missing, add: // TODO: In-memory store resets on deploy and is per-instance. Migrate to Upstash Redis when scaling. See SECURITY_AUDIT.md INFRA-02
- No code changes needed — this is acceptable for current single-instance deployment

Run npm run build after all changes. Commit with message "security: rate limiting, profile client fix, timing-safe, health sanitization (API-01, API-02, API-03, BIZ-02, DATA-02)"

Output <promise>DONE</promise> when build passes.
