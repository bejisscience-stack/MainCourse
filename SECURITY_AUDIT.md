# Security Audit Report — Swavleba (MainCourse)

| Field           | Value                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Date**        | 2026-03-13                                                                                                                  |
| **Scope**       | Full-stack audit: Next.js 14 app, Supabase backend, 47 API routes, 28 edge functions, storage policies, payment integration |
| **Methodology** | Manual source code review, dependency audit (`npm audit`), CSP analysis, RLS policy review, storage policy analysis         |
| **Auditor**     | Claude Code (automated)                                                                                                     |
| **Codebase**    | Branch `staging`, commit `3531531`                                                                                          |

---

## Summary

| Severity  | Count  |
| --------- | ------ |
| CRITICAL  | 0      |
| HIGH      | 2      |
| MEDIUM    | 5      |
| LOW       | 4      |
| INFO      | 0      |
| **Total** | **11** |

---

## Top 5 Urgent Items

| #   | ID       | Severity | Summary                                                                     |
| --- | -------- | -------- | --------------------------------------------------------------------------- |
| 1   | STOR-001 | HIGH     | Public storage bucket exposes paid course videos to anyone with URL pattern |
| 2   | DEP-001  | HIGH     | Next.js 14.2.35 has known DoS vulnerabilities (CVSS 7.5)                    |
| 3   | LOG-001  | MEDIUM   | Keepz API error responses logged with full body via JSON.stringify          |
| 4   | STOR-002 | MEDIUM   | No file type validation (MIME/extension/magic bytes) on storage uploads     |
| 5   | CSP-001  | MEDIUM   | `style-src 'unsafe-inline'` required for Tailwind CSS                       |

---

## Overall Security Rating

### 8.2 / 10

**Justification:** The codebase demonstrates strong security practices across authentication, authorization, payment verification, and input validation. All API routes and edge functions verify auth tokens. RLS is enabled on all data tables. CSP uses nonce-based script allowlisting. Payment processing uses RSA-OAEP + AES-256-CBC encryption with IP allowlisting and amount validation. The two HIGH findings (public video bucket and outdated Next.js) are significant but bounded in impact — the video bucket exposes content but not user data, and the Next.js vulnerabilities are DoS-class, not RCE. The recent migration 131 fixes (SEC-02 through SEC-08) demonstrate active security maintenance.

---

## What IS Properly Secured

### 1. Authentication — All Routes Verified

All 47 API routes use `verifyTokenAndGetUser(token)` via Bearer token extraction. All 28 edge functions use `getAuthenticatedUser(req)` from `_shared/auth.ts`. No unauthenticated data access paths found.

### 2. Row-Level Security (RLS) — Enabled on All Data Tables

RLS is enabled on all tables including `profiles`, `courses`, `enrollments`, `messages`, `channels`, `videos`, `keepz_payments`, `saved_cards`, `project_subscriptions`, and more. Policies are scoped to owner, admin, or co-enrolled users.

### 3. CORS — Explicit Origin Allowlist

`supabase/functions/_shared/cors.ts:6-18` — Origins restricted to `swavleba.ge`, `www.swavleba.ge`, and DigitalOcean app URL. No wildcards (`*`). Localhost only included in non-production environments.

### 4. Content Security Policy — Nonce-Based Script Allowlisting

`middleware.ts:96-108` — `script-src` uses per-request nonces generated from `crypto.randomUUID()`. `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'` all set. `frame-src` scoped to Keepz checkout domain only.

### 5. Security Headers — Complete Set

`next.config.js:34-102` — HSTS (1 year + includeSubDomains), X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (camera/mic/geo disabled), X-XSS-Protection.

### 6. Payment Verification — Defense in Depth

`lib/keepz.ts` — RSA-OAEP + AES-256-CBC hybrid encryption for all Keepz API communication. `app/api/payments/keepz/callback/route.ts:36-73` — IP allowlist with hard block in production when `KEEPZ_ALLOWED_IPS` is not configured. `route.ts:100-119` — Plaintext callbacks rejected; only encrypted payloads accepted. `route.ts:224-253` — Amount validation: callback amount must match DB record. `route.ts:116-123` — Idempotency: `complete_keepz_payment` RPC handles duplicate callbacks.

### 7. Rate Limiting — Upstash Redis on All Sensitive Endpoints

`lib/rate-limit.ts` — Dedicated limiters for login (5/60s), payment (3/60s), password reset (3/900s), admin (30/60s), callback (30/60s), referral (10/60s), subscription (3/60s), notification (60/60s). All use Upstash Redis sliding window.

### 8. Input Validation — Zod Schemas on API Routes

`lib/schemas/index.ts` — `paymentOrderSchema`, `enrollmentRequestSchema`, `bundleEnrollmentRequestSchema`, `completeProfileSchema` all use strict Zod validation with UUID checks, enum constraints, and regex patterns.

### 9. Open Redirect Protection

`lib/validate-redirect.ts:6-13` — `validateRedirectUrl()` blocks protocol-relative URLs (`//evil.com`), backslash URLs (`\evil.com`), and non-relative paths. Only allows paths starting with `/`.

### 10. Session Security — Secure Cookie Configuration

`middleware.ts:56-62` — Team access cookie uses `httpOnly: true`, `secure: true` in production, `sameSite: 'lax'`, short-lived 15-minute expiry.

### 11. Timing-Safe Comparison

`middleware.ts:15-25` — Custom `timingSafeCompare()` function pads both inputs to equal length to prevent timing side-channel attacks on access key verification. Edge Runtime compatible (no Node.js `crypto`).

### 12. Error Sanitization — Generic Errors to Clients

`lib/admin-auth.ts:66-69` — `internalError()` helper logs detailed errors server-side but returns only "Internal server error" to clients. `app/api/payments/keepz/create-order/route.ts:348-361` — Keepz errors return "An error occurred" without internal details.

### 13. Audit Logging — Admin Actions via SECURITY DEFINER

`supabase/migrations/131_security_audit_fixes.sql:12-86` — `approve_enrollment_request()` and `approve_bundle_enrollment_request()` are `SECURITY DEFINER` functions with `check_is_admin(auth.uid())` guards. `app/api/payments/keepz/callback/route.ts:9-28` — `payment_audit_log` records all callback events.

### 14. Path Traversal Protection — Video URL Validation

Video URL API routes validate paths using `startsWith` checks against known course directories to prevent path traversal attacks.

### 15. Price from Database — Not Client-Supplied

`app/api/payments/keepz/create-order/route.ts:46-114` — Payment amounts are always fetched server-side from the database (course price, bundle price, or subscription price). Client-supplied amounts are never trusted.

### 16. Secrets Management — No Env Files in Git History

Confirmed: `.env.staging` and other env files are gitignored and have never been committed to the repository.

---

## Detailed Findings

---

### STOR-001 — Public Storage Bucket for Paid Course Videos

| Field          | Value                                                                  |
| -------------- | ---------------------------------------------------------------------- |
| **Severity**   | HIGH                                                                   |
| **Category**   | Storage / Access Control                                               |
| **File**       | `supabase/migrations/029_fix_storage_policies.sql:97-100`              |
| **Also noted** | `supabase/migrations/122_private_payment_screenshots_bucket.sql:41-43` |
| **Priority**   | P1                                                                     |

**Description:**
The `course-videos` storage bucket has a public SELECT policy with no access restrictions beyond the bucket name. Any user (authenticated or not) can read all video files if they know or guess the URL pattern (`/storage/v1/object/public/course-videos/{courseId}/{filename}`).

**Evidence:**

```sql
-- supabase/migrations/029_fix_storage_policies.sql:97-100
CREATE POLICY "Public can view videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-videos');
```

This was explicitly acknowledged as a known risk in migration 122:

```sql
-- supabase/migrations/122_private_payment_screenshots_bucket.sql:41-43
-- NOTE: course-videos bucket is also public with guessable URLs.
-- Video URLs follow the pattern: /storage/v1/object/public/course-videos/{courseId}/{filename}
-- This is a known risk but NOT changed in this migration.
```

**Impact:**
Anyone can access paid course video content via direct URL pattern without authentication. This bypasses the enrollment paywall — course videos that users pay for are freely accessible.

**Recommendation:**

1. Make the `course-videos` bucket private (`UPDATE storage.buckets SET public = false WHERE id = 'course-videos'`)
2. Create a RLS policy restricting SELECT to enrolled users (similar to the `payment-screenshots` fix in migration 122)
3. Implement signed URLs in the video delivery API route with short expiry times
4. Existing public URLs will stop working immediately — coordinate with frontend

---

### DEP-001 — Next.js Known Vulnerabilities (CVSS 7.5)

| Field        | Value                     |
| ------------ | ------------------------- |
| **Severity** | HIGH                      |
| **Category** | Dependency / Supply Chain |
| **File**     | `package.json:29`         |
| **Priority** | P1                        |

**Description:**
The application uses `next@^14.2.35` which has known high-severity vulnerabilities.

**Evidence:**

```
$ npm audit

next  10.0.0 - 15.5.9
Severity: high
- Next.js self-hosted applications vulnerable to DoS via Image Optimizer
  remotePatterns configuration (GHSA-9g9p-9gw9-jx7f)
- Next.js HTTP request deserialization can lead to DoS when using insecure
  React Server Components (GHSA-h25m-26qc-wcjf)
fix available via `npm audit fix --force` → next@16.1.6 (breaking change)
```

**Impact:**
Denial of service attacks against the image optimization endpoint and React Server Components. Both are DoS-class (availability), not RCE (confidentiality/integrity).

**Recommendation:**
Upgrade to Next.js 16.x (semver major). This requires testing all pages, API routes, and middleware for breaking changes. The `remotePatterns` config in `next.config.js:21-24` may need updates for the new Next.js version.

---

### CSP-001 — style-src unsafe-inline Required for Tailwind

| Field        | Value                   |
| ------------ | ----------------------- |
| **Severity** | MEDIUM                  |
| **Category** | Content Security Policy |
| **File**     | `middleware.ts:99`      |
| **Priority** | P2                      |

**Description:**
The Content Security Policy includes `style-src 'self' 'unsafe-inline'` because Tailwind CSS generates inline styles at runtime. This is a documented and accepted trade-off.

**Evidence:**

```typescript
// middleware.ts:96-99
const cspHeader = [
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}'`,
  "style-src 'self' 'unsafe-inline'",
  // ...
```

The rationale is documented in comments at `middleware.ts:90-95`:

```typescript
// SECURITY NOTE (CSP-01): style-src 'unsafe-inline' is required for Tailwind CSS
// CSS injection is lower impact than script injection (no code execution)
// script-src uses nonce-based allowlisting which prevents XSS script execution
```

**Impact:**
CSS injection is possible if an attacker can inject arbitrary HTML, but this cannot escalate to script execution because `script-src` uses nonces. Impact is limited to visual defacement or data exfiltration via CSS selectors (low probability in this application).

**Recommendation:**
Long-term: migrate to nonce-based style loading or extract Tailwind styles to external stylesheets. Short-term: accepted risk with documented justification.

---

### CSP-002 — SVG Rendering Config

| Field        | Value                                      |
| ------------ | ------------------------------------------ |
| **Severity** | MEDIUM                                     |
| **Category** | Content Security Policy / Image Processing |
| **File**     | `next.config.js:14-20`                     |
| **Priority** | P2                                         |

**Description:**
`dangerouslyAllowSVG` is enabled for Next.js image optimization, with a restrictive sandbox CSP as mitigation.

**Evidence:**

```javascript
// next.config.js:14-20
// SECURITY (CSP-02): dangerouslyAllowSVG enabled for next/image SVG rendering.
// Mitigated by restrictive contentSecurityPolicy below (script-src 'none', sandbox).
// Current SVG sources: admin-uploaded course thumbnails and platform assets only.
dangerouslyAllowSVG: true,
contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
```

**Impact:**
SVG-based XSS is possible if user-uploaded SVGs are ever accepted through the image optimization pipeline. Currently mitigated by: (1) only admin-uploaded SVGs are served, (2) sandbox CSP on rendered SVGs blocks script execution. Risk increases if user SVG uploads are added in the future.

**Recommendation:**
Verify that all upload handlers reject SVG files from non-admin users. If user SVG uploads are needed in the future, implement DOMPurify sanitization before storage.

---

### LOG-001 — Sensitive Data in Server Logs

| Field        | Value                            |
| ------------ | -------------------------------- |
| **Severity** | MEDIUM                           |
| **Category** | Information Disclosure / Logging |
| **Files**    | `lib/keepz.ts:216,226,235,245`   |
| **Priority** | P2                               |

**Description:**
Keepz API error responses are logged with full body content via `JSON.stringify()`. While the primary payment data is encrypted, error responses may contain metadata, order IDs, or diagnostic information that shouldn't persist in hosting provider logs.

**Evidence:**

```typescript
// lib/keepz.ts:216
console.error(
  "[Keepz] Non-JSON response:",
  response.status,
  rawText.substring(0, 500),
);

// lib/keepz.ts:226
console.error("[Keepz] API error response:", JSON.stringify(body));

// lib/keepz.ts:235
console.error("[Keepz] HTTP error:", response.status, JSON.stringify(body));

// lib/keepz.ts:245
console.error(
  "[Keepz] Missing encrypted fields in response:",
  JSON.stringify(body),
);
```

Note: The callback route (`app/api/payments/keepz/callback/route.ts:352-361`) logs error stack traces in the unhandled error catch block, but this is standard error handling and uses `String(error)` which is acceptable.

**Impact:**
Payment-related metadata could persist in DigitalOcean application logs. While encrypted payment data is not logged in plaintext, error response bodies from Keepz may contain order identifiers, status codes, and diagnostic messages.

**Recommendation:**
Log only error codes, status codes, and generic messages. Replace `JSON.stringify(body)` with selective field logging: `{ statusCode: body.statusCode, message: body.message }`.

---

### STOR-002 — No File Type Validation on Storage Uploads

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| **Severity** | MEDIUM                                       |
| **Category** | Storage / Input Validation                   |
| **Files**    | Storage policies in migrations 024, 029, 096 |
| **Priority** | P2                                           |

**Description:**
Supabase storage upload policies check bucket ID and user ownership but do not validate file extensions, MIME types, or magic bytes. This allows MIME type spoofing — a user could upload an HTML file as a "video" if they know the correct folder structure.

**Evidence:**

```sql
-- supabase/migrations/029_fix_storage_policies.sql:20-30
CREATE POLICY "Lecturers can upload videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-videos' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id::text = (storage.foldername(name))[1]
    AND courses.lecturer_id = auth.uid()
  )
);
```

No file extension or content-type restrictions in any storage policy.

**Impact:**
MIME type spoofing could allow storing unexpected file types. Combined with STOR-001 (public bucket), a malicious lecturer could theoretically upload HTML/JS files to the public video bucket. Impact is partially mitigated by the fact that only lecturers (not students) can upload, and SVG rendering has a sandbox CSP.

**Recommendation:**
Add server-side file extension validation (allowlist `.mp4`, `.webm`, `.mov` for videos; `.jpg`, `.png`, `.webp` for thumbnails). Optionally add magic byte validation in the upload API route.

---

### AUTH-001 — Admin RPC Failure Mode

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| **Severity** | MEDIUM                                                                |
| **Category** | Authentication / Error Handling                                       |
| **Files**    | `lib/admin-auth.ts:40-49`, `supabase/functions/_shared/auth.ts:80-94` |
| **Priority** | P3                                                                    |

**Description:**
The `check_is_admin` RPC returns `false` on failure (database error, timeout, etc.), which is a safe default (fails closed). However, this makes it impossible to distinguish "user is not an admin" from "admin check failed due to infrastructure issue."

**Evidence:**

```typescript
// lib/admin-auth.ts:40-49
try {
  const { data, error } = await supabase.rpc("check_is_admin", {
    user_id: user.id,
  });
  if (error || data !== true) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
} catch {
  return NextResponse.json({ error: "Access denied" }, { status: 403 });
}
```

```typescript
// supabase/functions/_shared/auth.ts:80-94
export async function checkIsAdmin(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_is_admin", {
    user_id: userId,
  });
  if (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
  return data === true;
}
```

**Impact:**
Low — the system fails closed (safe). But during database outages, admins are silently locked out with no differentiation from unauthorized access. This makes debugging harder during incidents.

**Recommendation:**
Distinguish the two cases in logging: log "admin check failed: DB error" vs "admin check: not admin". Optionally return a 503 instead of 403 when the RPC itself errors.

---

### CFG-001 — No HTTPS Enforcement on Payment Redirect URL

| Field        | Value                                              |
| ------------ | -------------------------------------------------- |
| **Severity** | LOW                                                |
| **Category** | Configuration                                      |
| **File**     | `app/api/payments/keepz/create-order/route.ts:244` |
| **Priority** | P3                                                 |

**Description:**
The payment redirect URLs are constructed from `NEXT_PUBLIC_APP_URL` with a hardcoded HTTPS fallback. If the environment variable is misconfigured to an HTTP URL, payment redirect URLs would use plain HTTP.

**Evidence:**

```typescript
// app/api/payments/keepz/create-order/route.ts:244
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://swavleba.ge";
```

**Impact:**
If `NEXT_PUBLIC_APP_URL` is set to `http://...`, the success/fail redirect URLs after payment would use HTTP, potentially exposing the payment ID parameter to MITM. The fallback default is HTTPS, so this only applies if the env var is explicitly misconfigured.

**Recommendation:**
Add a runtime assertion: `if (!appUrl.startsWith('https://')) throw new Error('NEXT_PUBLIC_APP_URL must use HTTPS')` or strip and re-add the protocol.

---

### CFG-002 — Service Role Key Not Required in Development

| Field        | Value                          |
| ------------ | ------------------------------ |
| **Severity** | LOW                            |
| **Category** | Configuration                  |
| **File**     | `lib/supabase-server.ts:24-54` |
| **Priority** | P3                             |

**Description:**
In development, the `createServiceRoleClient()` function falls back to the user token or anon key when `SUPABASE_SERVICE_ROLE_KEY` is not set. In production, it correctly throws a fatal error.

**Evidence:**

```typescript
// lib/supabase-server.ts:24-30
export function createServiceRoleClient(fallbackToken?: string) {
  if (!supabaseServiceRoleKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "FATAL: SUPABASE_SERVICE_ROLE_KEY is required in production.",
      );
    }
    // Falls back to user token or anon key in development
```

**Impact:**
In development, admin operations may accidentally use wrong privilege levels, which could mask RLS policy bugs that would surface in production. Production is protected by the fatal error.

**Recommendation:**
Consider requiring `SUPABASE_SERVICE_ROLE_KEY` in all environments, or add a prominent console warning when development operations fall back to non-service-role access.

---

### CFG-003 — DigitalOcean Preview URL in CORS Allowlist

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| **Severity** | LOW                                    |
| **Category** | Configuration / CORS                   |
| **File**     | `supabase/functions/_shared/cors.ts:9` |
| **Priority** | P3                                     |

**Description:**
The DigitalOcean App Platform preview URL is included as a permanent CORS origin in the edge function allowlist.

**Evidence:**

```typescript
// supabase/functions/_shared/cors.ts:6-10
const PRODUCTION_ORIGINS = [
  "https://swavleba.ge",
  "https://www.swavleba.ge",
  "https://plankton-app-wpsym.ondigitalocean.app",
];
```

**Impact:**
Minor. The preview URL is a legitimate deployment target but keeping it as a permanent production CORS origin means any code deployed to that DigitalOcean app can make authenticated cross-origin requests to edge functions. Edge functions still require valid auth tokens, so the blast radius is limited to authenticated users who visit the preview URL.

**Recommendation:**
Move the DigitalOcean preview URL to a non-production CORS list (similar to how localhost is handled on line 16-18), or make it configurable via environment variable.

---

### RATE-001 — Rate Limiter In-Memory Fallback Without Redis

| Field        | Value                          |
| ------------ | ------------------------------ |
| **Severity** | LOW                            |
| **Category** | Infrastructure / Rate Limiting |
| **File**     | `lib/rate-limit.ts:10-19`      |
| **Priority** | P3                             |

**Description:**
If Upstash Redis credentials are not configured, the rate limiter falls back to an in-memory `Map`. This is per-instance only and resets on each deploy. In production, a CRITICAL-level warning is logged.

**Evidence:**

```typescript
// lib/rate-limit.ts:10-19
if (!hasRedis) {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[Rate Limit] CRITICAL: Upstash Redis not configured in production. " +
        "Rate limits are ephemeral and per-instance.",
    );
  } else {
    console.warn(
      "[Rate Limit] Upstash Redis not configured — using in-memory fallback (dev only)",
    );
  }
}
```

**Impact:**
If Redis credentials are accidentally removed from production environment variables, rate limiting degrades to per-instance in-memory storage. This is a resilience concern rather than a direct vulnerability. The CRITICAL log warning provides visibility.

**Recommendation:**
Consider failing fast in production (throwing an error) instead of degrading silently, similar to the `createServiceRoleClient` pattern in `lib/supabase-server.ts:26-29`. Alternatively, add a health check endpoint that verifies Redis connectivity.

---

## Previously Fixed Items (Migration 131)

The following issues were identified and fixed in `supabase/migrations/131_security_audit_fixes.sql`:

| ID     | Fix                             | Description                                                                                                                                                                                                                                                        |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SEC-02 | Profile SELECT restriction      | Dropped overly-permissive "Users can view profile usernames" policy that exposed `balance` and `bank_account_number` to all authenticated users. Replaced with co-enrollment and lecturer-student policies. Created `public_profiles` view with safe columns only. |
| SEC-03 | Bundle enrollment INSERT policy | Dropped direct INSERT policy on `bundle_enrollments` — enrollments now only happen through `approve_bundle_enrollment_request()` SECURITY DEFINER RPC.                                                                                                             |
| SEC-04 | Double-credit prevention        | Added `status = 'pending'` check to `approve_enrollment_request()` and `approve_bundle_enrollment_request()` RPCs to prevent approving already-approved requests.                                                                                                  |
| SEC-08 | Enrollment expiry enforcement   | Added `expires_at` checks to RLS policies on `channels`, `videos`, and `messages` tables. Users with expired enrollments can no longer access course content or post messages.                                                                                     |

Additional security fixes applied in recent commits:

| Commit    | Fix                                                                                     |
| --------- | --------------------------------------------------------------------------------------- |
| `3531531` | Removed debug fetch call, sanitized subscription error responses (HIGH-004, MEDIUM-001) |
| `c25e293` | Fixed 9 vulnerabilities from security audit (SEC-01 through SEC-15)                     |
| `bf3f695` | Sanitized remaining error response leaks (SEC-16 follow-up)                             |

---

## Methodology Notes

### What Was Checked

- All files in `app/api/` — authentication, authorization, input validation, error handling
- All files in `supabase/functions/` — auth patterns, CORS, error responses
- All files in `supabase/migrations/` — RLS policies, storage policies, SECURITY DEFINER functions
- `middleware.ts` — CSP, session handling, timing-safe comparison
- `next.config.js` — security headers, image optimization settings
- `lib/` — rate limiting, admin auth, payment crypto, redirect validation, Zod schemas
- `package.json` — dependency vulnerabilities via `npm audit`
- `.gitignore` — secrets not committed

### What Was NOT Checked

- Runtime behavior (no penetration testing performed)
- Infrastructure configuration (DigitalOcean, DNS, TLS certificates)
- Supabase dashboard settings (auth providers, email templates, SMTP)
- Third-party service configurations (Keepz, Resend, PostHog, Upstash)
- Client-side JavaScript bundle for prototype pollution or DOM XSS
- Social engineering or phishing vectors

### Limitations

- Line numbers reference the current `staging` branch and may shift as code changes
- Storage policies were reviewed from migration files; live database state may differ if manual changes were applied
- `npm audit` findings are point-in-time and change as new advisories are published
- This audit is documentation-only — no fixes were applied as part of this report
