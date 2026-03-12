# Security Audit — Swavleba (MainCourse)

**Date:** 2026-03-12
**Scope:** Full codebase audit — auth, RLS, API, payments, secrets, client-side, data exposure, infrastructure, business logic
**Platform:** Next.js 14, Supabase (Auth + DB + Storage + Edge Functions), Keepz payments
**Environment:** Production at swavleba.ge, staging at staging branch

---

## Executive Summary

| Severity  | Count  |
| --------- | ------ |
| CRITICAL  | 1      |
| HIGH      | 4      |
| MEDIUM    | 8      |
| LOW       | 6      |
| **Total** | **19** |

**Overall Security Posture: MODERATE**

The platform has solid foundations — Bearer token auth, RLS enabled on all tables, HSTS, CSP headers, encrypted payment callbacks, and timing-safe comparisons in middleware. However, one critical RLS gap allows any authenticated user to create/modify courses, and several high-severity issues around CORS, rate limiting, and storage limits need attention before scaling.

### Top 5 Urgent Fixes

1. **[CRITICAL]** Restrict courses INSERT/UPDATE RLS to lecturers/admins only
2. **[HIGH]** Replace wildcard CORS with explicit origin allowlist in edge functions
3. **[HIGH]** Add rate limiting to referral validation and coming-soon subscribe endpoints
4. **[HIGH]** Set file size limits on `course-videos` and `course-thumbnails` storage buckets
5. **[MEDIUM]** Migrate CSP `script-src` from `'unsafe-inline'` to nonce-based

---

## Phase 1: Authentication & Session Management

### AUTH-01: Edge function auth error leaks Supabase error message

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| **Severity** | MEDIUM                                  |
| **Location** | `supabase/functions/_shared/auth.ts:56` |
| **Priority** | P2                                      |

**Description:** The `getAuthenticatedUser` function passes the raw Supabase auth error message directly to the client response. This can reveal internal details about token validation failures, expiration reasons, or Supabase-specific error codes.

**Evidence:**

```typescript
// auth.ts:54-57
if (authError || !user) {
  return {
    response: errorResponse(authError?.message || "Unauthorized", 401),
  };
}
```

**Impact:** Information disclosure — attackers can enumerate auth failure modes (expired token vs. malformed token vs. revoked token) to refine attack strategies.

**Recommendation:** Return a generic `"Unauthorized"` message to clients. Log the detailed error server-side only:

```typescript
if (authError || !user) {
  console.error("[Auth] Verification failed:", authError?.message);
  return { response: errorResponse("Unauthorized", 401) };
}
```

---

### AUTH-02: API error response leaks auth details

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| **Severity** | MEDIUM                                       |
| **Location** | `app/api/validate-referral-code/route.ts:21` |
| **Priority** | P2                                           |

**Description:** The validate-referral-code endpoint returns `userError?.message` in the response body, exposing Supabase auth internals to unauthenticated callers.

**Evidence:**

```typescript
// validate-referral-code/route.ts:19-23
if (userError || !user) {
  return NextResponse.json(
    { error: "Unauthorized", details: userError?.message },
    { status: 401 },
  );
}
```

The same pattern appears in `app/api/profile/route.ts:20-24` (GET) and `route.ts:62-66` (PATCH).

**Impact:** Attackers learn whether a token is expired, malformed, or revoked — aids in session hijacking and token replay attacks.

**Recommendation:** Remove the `details` field from all 401 responses. Log the error server-side.

---

## Phase 2: Row Level Security (RLS)

### RLS-01: Courses table INSERT/UPDATE policies are overly permissive [CRITICAL]

| Field        | Value                                                    |
| ------------ | -------------------------------------------------------- |
| **Severity** | CRITICAL                                                 |
| **Location** | `supabase/migrations/005_create_courses_table.sql:35-43` |
| **Priority** | P0 — Fix immediately                                     |

**Description:** The courses table RLS policies allow ANY authenticated user to insert and update ANY course. The policy name says "for admin/creators" but the actual check only verifies `auth.role() = 'authenticated'`, which is true for every logged-in user including students.

**Evidence:**

```sql
-- 005_create_courses_table.sql:35-38
CREATE POLICY "Authenticated users can insert courses"
  ON public.courses FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 005_create_courses_table.sql:41-43
CREATE POLICY "Authenticated users can update courses"
  ON public.courses FOR UPDATE
  USING (auth.role() = 'authenticated');
```

**Impact:** Any authenticated student can:

- Create fake courses with arbitrary pricing
- Modify existing course titles, descriptions, and prices
- Change `author` and `creator` fields to impersonate lecturers
- Inject malicious content into course descriptions

**Recommendation:** Restrict to lecturers (own courses) and admins:

```sql
CREATE POLICY "Lecturers can insert own courses"
  ON public.courses FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('lecturer', 'admin')
    )
  );

CREATE POLICY "Lecturers can update own courses"
  ON public.courses FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    (
      lecturer_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  );
```

---

## Phase 3: API Security

### API-01: No rate limit on referral code validation

| Field        | Value                                                   |
| ------------ | ------------------------------------------------------- |
| **Severity** | HIGH                                                    |
| **Location** | `app/api/validate-referral-code/route.ts` (entire file) |
| **Priority** | P1                                                      |

**Description:** The referral code validation endpoint has no rate limiting applied. A `referralLimiter` exists in `lib/rate-limit.ts:72-75` but is never imported or used in this route. An attacker can brute-force referral codes at line speed.

**Evidence:**

```typescript
// validate-referral-code/route.ts - no rate limit import or check
import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
```

Compare with `lib/rate-limit.ts:72-75` which defines an unused limiter:

```typescript
export const referralLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
});
```

**Impact:** Referral codes are limited to 20 characters (validated at line 37). An authenticated attacker can enumerate all valid referral codes by brute-forcing the endpoint, enabling referral fraud.

**Recommendation:** Apply `referralLimiter` at the top of the POST handler:

```typescript
const ip = getClientIP(request);
const { allowed, retryAfterMs } = referralLimiter.check(ip);
if (!allowed) return rateLimitResponse(retryAfterMs);
```

---

### API-02: No rate limit on coming-soon subscribe

| Field        | Value                                                  |
| ------------ | ------------------------------------------------------ |
| **Severity** | HIGH                                                   |
| **Location** | `app/api/coming-soon/subscribe/route.ts` (entire file) |
| **Priority** | P1                                                     |

**Description:** The email subscription endpoint accepts unlimited requests with no rate limiting and no authentication. This is an open endpoint that inserts directly into the database using the service role client.

**Evidence:**

```typescript
// coming-soon/subscribe/route.ts:6-9
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;
    // ... no rate limit check anywhere in the handler
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from('coming_soon_emails')
      .insert({ email: email.toLowerCase().trim() });
```

**Impact:**

- Database spam: attacker can flood `coming_soon_emails` with garbage entries
- Resource exhaustion: each request creates a service role client and hits the database
- Email harvesting prep: even though duplicates return 200, the timing difference between "already exists" and "newly inserted" reveals whether an email is in the system

**Recommendation:** Add IP-based rate limiting (e.g., 3 requests per minute) and consider adding a CAPTCHA or honeypot field.

---

### API-03: Profile PATCH uses service role client unnecessarily

| Field        | Value                              |
| ------------ | ---------------------------------- |
| **Severity** | MEDIUM                             |
| **Location** | `app/api/profile/route.ts:104-106` |
| **Priority** | P2                                 |

**Description:** The PATCH handler creates a service role client to update the user's own profile, bypassing RLS entirely. The comment acknowledges this: "Use service role client to bypass RLS - auth is already verified above."

**Evidence:**

```typescript
// profile/route.ts:104-106
// Use service role client to bypass RLS - auth is already verified above
// Falls back to user token if service role key is not set
const supabase = createServiceRoleClient(token);
```

**Impact:** If there's a logic bug above the RLS bypass (e.g., `user.id` mismatch, TOCTOU race), the service role client will happily update any row. The same pattern appears in the GET handler at line 26.

**Recommendation:** Use a user-scoped client (`createServerSupabaseClient(token)`) and ensure the profiles table has a proper UPDATE RLS policy that checks `auth.uid() = id`. The RLS policy acts as a second layer of defense.

---

## Phase 4: Payment Security (Keepz)

### PAY-01: Missing Keepz callback IP whitelist

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| **Severity** | MEDIUM                                       |
| **Location** | `app/api/payments/keepz/callback/route.ts:8` |
| **Priority** | P2                                           |

**Description:** The payment callback endpoint relies solely on encrypted payload verification (RSA decryption) with no source IP validation. A TODO comment acknowledges this gap.

**Evidence:**

```typescript
// callback/route.ts:8
// TODO: Add Keepz IP whitelist when they publish static IPs.
// Currently relying on encrypted payload verification only. See SECURITY_AUDIT.md PAY-01
```

**Impact:** While the encrypted payload provides strong integrity verification (an attacker cannot forge a valid encrypted callback without Keepz's private key), IP whitelisting adds defense-in-depth. Without it, attackers can send crafted requests to probe the endpoint's error handling and timing behavior.

**Recommendation:** When Keepz publishes their static IP ranges, add IP validation as the first check in the handler. In the meantime, consider rate-limiting this endpoint by IP (the `paymentLimiter` exists but isn't applied here).

---

## Phase 5: Environment & Secrets

### ENV-01: `.env.example` not gitignored

| Field        | Value                                       |
| ------------ | ------------------------------------------- |
| **Severity** | LOW                                         |
| **Location** | `.env.example` (working tree), `.gitignore` |
| **Priority** | P3                                          |

**Description:** The `.env.example` file is untracked but present in the working tree, and `.gitignore` does not explicitly exclude it. Currently it contains only placeholder values, but there's a risk of accidentally committing real credentials if the file is edited for local testing.

**Evidence:**

```
# .env.example contents include:
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
MY_RSA_PRIVATE_KEY=your-rsa-private-key
TEAM_ACCESS_KEY=your-secret-key-here
```

The `.gitignore` patterns `.env*.local` and `.env` would NOT match `.env.example`.

**Impact:** Low — current content is safe. Risk is future accidental commit with real values.

**Recommendation:** Either add `.env.example` to `.gitignore` or commit it intentionally (with only placeholder values) as a developer reference. Being explicit is better than leaving it ambiguous.

---

## Phase 6: Client-Side Security

### CSP-01: Content Security Policy allows `unsafe-inline` scripts

| Field        | Value                  |
| ------------ | ---------------------- |
| **Severity** | MEDIUM                 |
| **Location** | `next.config.js:67-68` |
| **Priority** | P2                     |

**Description:** The CSP `script-src` directive includes `'unsafe-inline'`, which significantly weakens XSS protection. A TODO comment acknowledges the need to migrate to nonce-based scripts.

**Evidence:**

```javascript
// next.config.js:65-68
// TODO: migrate 'unsafe-inline' in script-src to nonce-based scripts
key: "Content-Security-Policy",
value:
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; ..."
```

**Impact:** XSS payloads can execute inline scripts, bypassing the CSP protection that should prevent them. This is the primary defense against stored and reflected XSS.

**Recommendation:** Migrate to nonce-based CSP. Next.js 14 supports this via `nonce` in `_document.tsx` or middleware. Replace `'unsafe-inline'` with `'nonce-{random}'` generated per request. Note: `style-src 'unsafe-inline'` is generally acceptable due to Tailwind's usage patterns.

---

### CSP-02: `dangerouslyAllowSVG` enabled in image config

| Field        | Value               |
| ------------ | ------------------- |
| **Severity** | MEDIUM              |
| **Location** | `next.config.js:16` |
| **Priority** | P2                  |

**Description:** SVG rendering is enabled via Next.js image optimization with `dangerouslyAllowSVG: true`. A restrictive `contentSecurityPolicy` is applied to SVG rendering (`script-src 'none'; sandbox;`), which mitigates script execution. However, SVGs can still contain other attack vectors.

**Evidence:**

```javascript
// next.config.js:14-17
// User-uploaded SVGs should still be sanitized server-side before storage.
dangerouslyAllowSVG: true,
contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
```

**Impact:** While the CSP sandbox blocks JavaScript in SVGs, malicious SVGs can still:

- Trigger XXE attacks if the SVG parser resolves external entities
- Contain CSS-based data exfiltration (`url()` in SVG styles)
- Render phishing content within the image frame

**Recommendation:** Implement server-side SVG sanitization (e.g., DOMPurify or svg-sanitize) on upload. The existing CSP sandbox is a good mitigation but not a complete defense.

---

## Phase 7: Data Exposure

### DATA-01: Course video URLs are publicly guessable

| Field        | Value                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **Severity** | MEDIUM                                                                                                                      |
| **Location** | `supabase/migrations/010_create_storage_buckets.sql:9`, `supabase/migrations/122_private_payment_screenshots_bucket.sql:42` |
| **Priority** | P2                                                                                                                          |

**Description:** The `course-videos` bucket is public (`public: true`) and files follow a predictable URL pattern: `/storage/v1/object/public/course-videos/{courseId}/{filename}`. Anyone who knows or guesses a course UUID can access all its videos without authentication.

**Evidence:**

```sql
-- 010_create_storage_buckets.sql:5-9
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-videos',
  'course-videos',
  true,  -- publicly accessible
  ...
```

```sql
-- 122_private_payment_screenshots_bucket.sql:41-42
-- NOTE: course-videos bucket is also public with guessable URLs.
-- Video URLs follow the pattern: /storage/v1/object/public/course-videos/{courseId}/{filename}
```

**Impact:** Course videos are the primary paid content. Anyone can access them without purchasing by guessing or discovering course UUIDs (which may leak via API responses, network traffic, or page source).

**Recommendation:** Make the `course-videos` bucket private and serve videos through a signed URL endpoint that verifies the user has purchased/enrolled in the course. This is a business-critical change that should be planned carefully to avoid breaking existing video playback.

---

### DATA-02: Health endpoint reveals table name

| Field        | Value                           |
| ------------ | ------------------------------- |
| **Severity** | LOW                             |
| **Location** | `app/api/health/route.ts:39-42` |
| **Priority** | P3                              |

**Description:** The health check queries the `profiles` table and may expose the table name and Supabase error messages in the response when the database is degraded.

**Evidence:**

```typescript
// health/route.ts:39-49
const { error } = await supabase
  .from('profiles')
  .select('id')
  .limit(1);

// ...
if (error) {
  healthStatus.checks.database.status = 'error';
  healthStatus.checks.database.error = error.message;
```

**Impact:** Minor information disclosure. Attackers learn table names and database error details which can aid in crafting SQL injection or API abuse attacks.

**Recommendation:** Replace the `profiles` query with a simple `SELECT 1` via `.rpc()` or a dedicated health-check function. Redact error messages in the response — log them server-side instead.

---

### DATA-03: Storage buckets have no file size limits (DoS vector)

| Field        | Value                                                            |
| ------------ | ---------------------------------------------------------------- |
| **Severity** | HIGH                                                             |
| **Location** | `supabase/migrations/100_fix_lecturer_upload_policies.sql:10-11` |
| **Priority** | P1                                                               |

**Description:** Migration 100 explicitly removes file size limits from both `course-videos` and `course-thumbnails` buckets, setting them to NULL (unlimited). Originally these had reasonable limits (50MB for videos, 5MB for thumbnails).

**Evidence:**

```sql
-- 100_fix_lecturer_upload_policies.sql:9-11
-- Remove file size limits from both buckets (set to NULL for unlimited)
UPDATE storage.buckets SET file_size_limit = NULL
WHERE id IN ('course-videos', 'course-thumbnails');
```

Prior to this migration (in `078_remove_video_size_limit.sql`), limits were 10GB for videos and 50MB for thumbnails — already generous but bounded.

**Impact:** A malicious lecturer (or compromised lecturer account) can upload arbitrarily large files, consuming all available Supabase storage and potentially causing:

- Storage cost explosion
- Service degradation for all users
- Denial of service

**Recommendation:** Reinstate reasonable file size limits:

- `course-videos`: 10GB (sufficient for long-form course content)
- `course-thumbnails`: 10MB (generous for images)

---

## Phase 8: Infrastructure

### INFRA-01: Edge function CORS allows all origins

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| **Severity** | HIGH                                   |
| **Location** | `supabase/functions/_shared/cors.ts:6` |
| **Priority** | P1                                     |

**Description:** All edge functions use a shared CORS config that sets `Access-Control-Allow-Origin: '*'`, allowing any website to make cross-origin requests to the edge functions.

**Evidence:**

```typescript
// cors.ts:5-8
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, cache-control, x-scraper-secret",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};
```

**Impact:** Any malicious website can make authenticated requests to edge functions if a user visits it while logged in. While Bearer token auth prevents cookie-based CSRF, the wildcard CORS:

- Allows any origin to call edge functions and read responses
- Exposes the `x-scraper-secret` header name (see LOW-02)
- Could enable data exfiltration if combined with token theft

**Recommendation:** Replace `'*'` with an explicit allowlist:

```typescript
const ALLOWED_ORIGINS = [
  "https://swavleba.ge",
  "https://www.swavleba.ge",
  process.env.NODE_ENV === "development" && "http://localhost:3000",
].filter(Boolean);
```

---

### INFRA-02: Rate limiting is in-memory only

| Field        | Value                                                        |
| ------------ | ------------------------------------------------------------ |
| **Severity** | MEDIUM                                                       |
| **Location** | `lib/rate-limit.ts:1` (TODO comment), `lib/rate-limit.ts:14` |
| **Priority** | P2                                                           |

**Description:** The rate limiter uses an in-memory `Map` that resets on every deployment and is not shared across multiple server instances. A TODO comment acknowledges this.

**Evidence:**

```typescript
// rate-limit.ts:1
// TODO: In-memory store resets on deploy. Migrate to Upstash Redis when scaling to multiple instances.

// rate-limit.ts:14
private store = new Map<string, RateLimitEntry>();
```

**Impact:**

- Every deployment resets all rate limit counters, creating a window for abuse
- If running multiple instances (DigitalOcean App Platform can scale), requests are distributed across instances, each with independent counters — effectively multiplying the allowed rate by the instance count
- Currently acceptable for single-instance deployment but will fail silently when scaling

**Recommendation:** Migrate to Upstash Redis (serverless, Edge-compatible) for distributed rate limiting. Keep the in-memory implementation as a fallback.

---

### INFRA-03: Next.js 14 has known CVEs

| Field        | Value             |
| ------------ | ----------------- |
| **Severity** | LOW               |
| **Location** | `package.json:27` |
| **Priority** | P3                |

**Description:** The project uses Next.js `^14.2.35`. Next.js 14 has known security advisories including CVE-2025-29927 (middleware bypass via `x-middleware-subrequest` header). While the caret range allows patch updates, major version upgrades to Next.js 15+ contain additional security fixes.

**Evidence:**

```json
"next": "^14.2.35",
```

**Impact:** Depends on specific CVEs applicable to the installed patch version. The middleware bypass CVE could allow attackers to bypass the coming-soon gate and team access checks.

**Recommendation:** Verify the exact installed version against known CVEs. Plan an upgrade path to Next.js 15+ during a maintenance window. In the meantime, ensure `npm audit` shows no unpatched high-severity issues for the current version.

---

## Phase 9: Business Logic

### BIZ-01: Audit logging implemented but only partially integrated

| Field        | Value                                                     |
| ------------ | --------------------------------------------------------- |
| **Severity** | MEDIUM                                                    |
| **Location** | `lib/audit-log.ts` (definition), `app/api/admin/` (usage) |
| **Priority** | P2                                                        |

**Description:** The `logAdminAction` utility exists and is integrated in 8 admin routes (enrollment approve/reject, subscription approve/reject, withdrawal approve/reject, bundle enrollment approve/reject). However, other sensitive operations are not audited.

**Evidence:**

```typescript
// lib/audit-log.ts:9-16
export async function logAdminAction(
  request: NextRequest,
  adminUserId: string,
  action: string,
  targetTable: string,
  targetId: string,
  metadata?: Record<string, unknown>,
): Promise<void> { ... }
```

Routes that DO call `logAdminAction`:

- `app/api/admin/enrollment-requests/[id]/approve/route.ts`
- `app/api/admin/enrollment-requests/[id]/reject/route.ts`
- `app/api/admin/project-subscriptions/[id]/approve/route.ts`
- `app/api/admin/project-subscriptions/[id]/reject/route.ts`
- `app/api/admin/withdrawals/[requestId]/approve/route.ts`
- `app/api/admin/withdrawals/[requestId]/reject/route.ts`
- `app/api/admin/bundle-enrollment-requests/[id]/approve/route.ts`
- `app/api/admin/bundle-enrollment-requests/[id]/reject/route.ts`

**Missing audit logging on:** course creation/updates, profile changes via admin, payment manual interventions, role changes, and any direct database modifications via service role.

**Impact:** Incomplete audit trail makes incident investigation and compliance reporting difficult. If a malicious admin or compromised admin account makes changes outside the audited routes, there's no record.

**Recommendation:** Add `logAdminAction` calls to all admin routes and any service-role operations that modify user data or financial records. Consider logging non-admin sensitive operations (password resets, payment initiations) as well.

---

### BIZ-02: Timing-safe compare leaks string length

| Field        | Value              |
| ------------ | ------------------ |
| **Severity** | LOW                |
| **Location** | `middleware.ts:12` |
| **Priority** | P3                 |

**Description:** The `timingSafeCompare` function returns `false` immediately when string lengths differ, which leaks the length of the secret `TEAM_ACCESS_KEY` through timing analysis.

**Evidence:**

```typescript
// middleware.ts:11-21
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false; // <-- early return leaks length
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);
  let mismatch = 0;
  for (let i = 0; i < aBuf.length; i++) {
    mismatch |= aBuf[i] ^ bBuf[i];
  }
  return mismatch === 0;
}
```

**Impact:** Low in practice. An attacker can determine the length of `TEAM_ACCESS_KEY` by measuring response times for different input lengths. However, knowing only the length doesn't make brute-forcing practical for keys of reasonable length (16+ characters). The coming-soon gate is also a temporary feature.

**Recommendation:** Pad both strings to the same length or hash both before comparing:

```typescript
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
```

---

### BIZ-03: `x-scraper-secret` header exposed in CORS allow list

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| **Severity** | LOW                                    |
| **Location** | `supabase/functions/_shared/cors.ts:7` |
| **Priority** | P3                                     |

**Description:** The CORS `Access-Control-Allow-Headers` list includes `x-scraper-secret`, which reveals the existence of a secret header used for internal scraper authentication.

**Evidence:**

```typescript
// cors.ts:7
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, x-scraper-secret',
```

**Impact:** Information disclosure. Attackers learn that a `x-scraper-secret` header exists, which helps them target the scraper endpoint specifically. They still need the actual secret value, but knowing the header name reduces the search space.

**Recommendation:** Only include `x-scraper-secret` in the CORS headers for the specific edge function that needs it, not in the shared config used by all functions.

---

### BIZ-04: No CSRF token on state-changing API routes

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| **Severity** | LOW                                     |
| **Location** | All `app/api/` POST/PATCH/DELETE routes |
| **Priority** | P3                                      |

**Description:** No API routes implement CSRF token validation. The application relies on Bearer token authentication (Authorization header) rather than cookies for API auth.

**Impact:** **Largely mitigated.** Bearer tokens in `Authorization` headers cannot be automatically sent by browsers in cross-origin requests (unlike cookies). The Bearer token pattern inherently prevents CSRF because:

- Tokens must be explicitly added to requests via JavaScript
- Cross-origin JavaScript cannot read the token from another origin's localStorage

The risk is limited to scenarios where the token is stored in a cookie (it isn't in this codebase).

**Recommendation:** No immediate action needed. Document the Bearer-token-as-CSRF-mitigation pattern in the security docs. If cookie-based auth is ever added, CSRF tokens become mandatory.

---

### BIZ-05: `createServiceRoleClient` used in profile GET handler

| Field        | Value                         |
| ------------ | ----------------------------- |
| **Severity** | LOW                           |
| **Location** | `app/api/profile/route.ts:26` |
| **Priority** | P3                            |

**Description:** The GET handler uses `createServiceRoleClient(token)` to fetch the user's own profile, bypassing RLS for a read operation that should work fine with user-scoped permissions.

**Evidence:**

```typescript
// profile/route.ts:26
const supabase = createServiceRoleClient(token);

const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("id, username, avatar_url, project_access_expires_at, role")
  .eq("id", user.id)
  .single();
```

**Impact:** If the `.eq("id", user.id)` filter is ever removed or modified incorrectly, the service role client would return any user's profile data. Using a user-scoped client would make this impossible by enforcing RLS.

**Recommendation:** Use `createServerSupabaseClient(token)` for user-facing read operations. Reserve service role for admin operations only.

---

## Summary Table

| ID       | Severity | Phase          | Title                                      | Location                                  |
| -------- | -------- | -------------- | ------------------------------------------ | ----------------------------------------- |
| RLS-01   | CRITICAL | RLS            | Courses INSERT/UPDATE too permissive       | `005_create_courses_table.sql:35-43`      |
| INFRA-01 | HIGH     | Infrastructure | Edge function CORS allows all origins      | `_shared/cors.ts:6`                       |
| API-01   | HIGH     | API            | No rate limit on referral validation       | `validate-referral-code/route.ts`         |
| API-02   | HIGH     | API            | No rate limit on coming-soon subscribe     | `coming-soon/subscribe/route.ts`          |
| DATA-03  | HIGH     | Data Exposure  | Storage buckets have no file size limits   | `100_fix_lecturer_upload_policies.sql:10` |
| CSP-01   | MEDIUM   | Client-Side    | CSP uses `unsafe-inline` for scripts       | `next.config.js:67`                       |
| PAY-01   | MEDIUM   | Payments       | Missing Keepz callback IP whitelist        | `callback/route.ts:8`                     |
| CSP-02   | MEDIUM   | Client-Side    | `dangerouslyAllowSVG` without sanitization | `next.config.js:16`                       |
| INFRA-02 | MEDIUM   | Infrastructure | Rate limiting is in-memory only            | `rate-limit.ts:14`                        |
| API-03   | MEDIUM   | API            | Profile PATCH uses service role client     | `profile/route.ts:106`                    |
| AUTH-02  | MEDIUM   | Auth           | Error response leaks auth details          | `validate-referral-code/route.ts:21`      |
| DATA-01  | MEDIUM   | Data Exposure  | Course video URLs are publicly guessable   | `010_create_storage_buckets.sql:9`        |
| AUTH-01  | MEDIUM   | Auth           | Edge function auth error leaks message     | `_shared/auth.ts:56`                      |
| BIZ-01   | MEDIUM   | Business Logic | Audit logging only partially integrated    | `lib/audit-log.ts`                        |
| DATA-02  | LOW      | Data Exposure  | Health endpoint reveals table name         | `health/route.ts:39`                      |
| BIZ-02   | LOW      | Business Logic | Timing-safe compare leaks length           | `middleware.ts:12`                        |
| BIZ-03   | LOW      | Business Logic | `x-scraper-secret` in CORS allow list      | `cors.ts:7`                               |
| BIZ-04   | LOW      | Business Logic | No CSRF tokens (mitigated by Bearer auth)  | All API routes                            |
| INFRA-03 | LOW      | Infrastructure | Next.js 14 known CVEs                      | `package.json:27`                         |
| ENV-01   | LOW      | Environment    | `.env.example` not gitignored              | `.env.example`, `.gitignore`              |

---

## Positive Security Controls Already in Place

- **RLS enabled** on all tables with appropriate policies (except courses INSERT/UPDATE)
- **Bearer token auth** pattern consistently used across API routes
- **HSTS** with 1-year max-age and includeSubDomains
- **CSP headers** present (even if `unsafe-inline` needs fixing)
- **Encrypted payment callbacks** — Keepz RSA decryption prevents callback forgery
- **Timing-safe comparison** in middleware (minor length leak noted)
- **Rate limiters defined** for login, payment, referral, password reset, and admin operations
- **Input validation** — Zod schemas and manual validation on critical endpoints
- **Private payment screenshots bucket** (migration 122) — correctly secured
- **Service role separation** — dedicated `createServiceRoleClient` vs user-scoped clients
- **Security headers** — X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **Edge function auth helper** — centralized `getAuthenticatedUser` with proper token verification
- **Audit logging infrastructure** — `logAdminAction` with IP tracking, integrated in 8 admin routes

---

_This audit is documentation only — no code changes were made._
