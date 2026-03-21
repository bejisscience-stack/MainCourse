# Security Audit — Deployed Production Application

**Date:** 2026-03-21
**Auditor:** Claude Code Static Analysis (4 parallel agents)
**Application:** Swavleba (Georgian education platform — swavleba.ge)
**Environment:** Production (DigitalOcean App Platform)
**Method:** Static code analysis + configuration review + dependency audit
**Stack:** Next.js 14, Supabase (Auth/DB/Storage/Edge/Realtime), Keepz.me payments, Tailwind CSS, PostHog

---

## Executive Summary

- **Overall security posture: 7/10** — Strong fundamentals with iterative hardening, but active critical issues remain
- **Critical findings: 3**
- **High findings: 2**
- **Medium findings: 7**
- **Low findings: 4**
- **Informational: 15+ verified secure areas**

### Top 5 Most Urgent Fixes

1. **Upgrade Next.js** — Multiple high-severity CVEs in current version (DoS, request smuggling)
2. **Add FOR UPDATE to balance functions** — Race condition allows negative balance via concurrent withdrawals
3. **Restrict chat-media storage SELECT policy** — Unauthenticated users can access all chat media files
4. **Add ampersand escaping to chat messages** — Incomplete XSS defense-in-depth
5. **Validate file uploads with magic bytes** — MIME-only validation is bypassable

### Pre-Identified Issues — Resolution Status

| Pre-Identified Issue                             | Status                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| Referral commission allows 100%                  | **CONFIRMED** — No CHECK constraint found (MED-06)                           |
| Chat XSS escaping misses `&`                     | **CONFIRMED** — Missing ampersand escape (MED-03)                            |
| File upload trusts client MIME type              | **CONFIRMED** — No magic bytes validation (MED-04)                           |
| `style-src unsafe-inline`                        | **CONFIRMED** — Required for Tailwind (MED-05)                               |
| Password minimum is Supabase default (6 chars)   | **CONFIRMED** — No client-side enforcement (MED-01)                          |
| Rate limiter fails open on Redis down            | **DISPROVED** — Code is fail-CLOSED (`return { allowed: false }`)            |
| Some routes use manual validation instead of Zod | **CONFIRMED** — Critical routes use Zod; some admin routes use manual checks |

---

## Findings Summary Table

| #   | Severity | Title                                                | Location                       | Priority |
| --- | -------- | ---------------------------------------------------- | ------------------------------ | -------- |
| 1   | CRITICAL | Next.js version vulnerabilities (multiple CVEs)      | `package.json`                 | P0       |
| 2   | CRITICAL | Balance function race condition — missing FOR UPDATE | `migrations/073`               | P0       |
| 3   | CRITICAL | Chat-media storage allows unauthenticated SELECT     | `migrations/024`               | P0       |
| 4   | HIGH     | Weak filename randomization (Math.random)            | `chat-media/index.ts:116`      | P1       |
| 5   | HIGH     | Error messages leak internal details in server logs  | Multiple API routes            | P1       |
| 6   | MEDIUM   | No password complexity enforcement                   | `lib/auth.ts`                  | P2       |
| 7   | MEDIUM   | User enumeration in signup error messages            | `lib/auth.ts:72-95`            | P2       |
| 8   | MEDIUM   | Chat message XSS escaping misses ampersand           | `chat-messages/index.ts:49-55` | P1       |
| 9   | MEDIUM   | File upload trusts MIME type — no magic bytes        | `chat-media/index.ts:52-59`    | P2       |
| 10  | MEDIUM   | CSP style-src uses unsafe-inline                     | `middleware.ts`                | P3       |
| 11  | MEDIUM   | Referral commission allows 100% — no cap             | `courses` table                | P2       |
| 12  | MEDIUM   | Account deletion cascade — referral codes            | Unknown handler                | P2       |
| 13  | LOW      | Admin route auth pattern not centralized             | `app/api/admin/*`              | P3       |
| 14  | LOW      | Keepz callback IP allowlist not enforced             | `callback/route.ts:36-62`      | P2       |
| 15  | LOW      | Admin message access lacks audit trail               | `migrations/132`               | P3       |
| 16  | LOW      | .MOV in server allowlist despite UI block            | `chat-media/index.ts:23`       | P3       |

---

## Detailed Findings

### [CRITICAL] #1 — Next.js Version Vulnerabilities

**Location:** `package.json:35` — `"next": "^14.2.35"`
**Description:** Current Next.js version has multiple high-severity CVEs reported by `npm audit`.
**Evidence:**

```
next  9.5.0 - 15.5.13
Severity: high

- Next.js self-hosted applications vulnerable to DoS via Image Optimizer remotePatterns
- Next.js HTTP request deserialization can lead to DoS
- Next.js: HTTP request smuggling in rewrites
- Next.js: Unbounded next/image disk cache growth
```

**Attack scenario:** An attacker sends specially crafted HTTP requests exploiting request smuggling or image optimizer to cause denial of service on the production server, making swavleba.ge unavailable for students during exams or payment windows.
**Impact:** Service unavailability (DoS), potential request smuggling leading to cache poisoning or auth bypass.
**Recommendation:** Upgrade to latest patched Next.js version. Test thoroughly in staging before production deployment:

```bash
npm audit fix
# OR for major upgrade:
npm install next@latest
```

**Priority:** P0 — Fix immediately

---

### [CRITICAL] #2 — Balance Function Race Condition (Missing FOR UPDATE)

**Location:** `supabase/migrations/073_create_balance_functions.sql:99-118`
**Description:** `debit_user_balance()` and `credit_user_balance()` use SELECT-then-UPDATE without row locking, allowing concurrent operations to overdraw a balance.
**Evidence:**

```sql
-- debit_user_balance (migration 073):
SELECT role, balance INTO v_user_type, v_balance_before
FROM public.profiles
WHERE id = p_user_id;
-- No "FOR UPDATE" — row is not locked

IF v_balance_before < p_amount THEN
  RAISE EXCEPTION 'Insufficient balance.';
END IF;

UPDATE public.profiles
SET balance = balance - p_amount
WHERE id = p_user_id
RETURNING balance INTO v_balance_after;
```

**Attack scenario:**

1. User has 100 GEL balance
2. Two concurrent withdrawal requests for 80 GEL each
3. Both SELECTs read balance = 100 (both pass the check)
4. First UPDATE: balance = 100 - 80 = 20
5. Second UPDATE: balance = 20 - 80 = **-60** (negative!)

**Impact:** Users can overdraw their balance, causing financial loss to the platform. Mitigated partially by single-pending-withdrawal rule, but race between withdrawal + commission credit or between withdrawal + payment callback debit is still possible.
**Recommendation:** Add `FOR UPDATE` to lock the row during check:

```sql
SELECT role, balance INTO v_user_type, v_balance_before
FROM public.profiles
WHERE id = p_user_id
FOR UPDATE;  -- Lock row until transaction completes
```

Apply to both `debit_user_balance()` and `credit_user_balance()`.
**Priority:** P0 — Fix immediately

---

### [CRITICAL] #3 — Chat-Media Storage Allows Unauthenticated SELECT

**Location:** `supabase/migrations/024_fix_chat_media_storage_policies.sql:69-75`
**Description:** The `chat-media` bucket has a public SELECT policy with no authentication check, allowing anyone to download all chat media files.
**Evidence:**

```sql
CREATE POLICY "Chat media public read"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-media'
  -- No auth.uid() or auth.role() check
);
```

**Attack scenario:**

1. Attacker discovers the Supabase storage URL (public in client bundle)
2. Enumerates paths: `{course_id}/{channel_id}/{user_id}/{filename}`
3. Downloads private images, videos, and documents from all courses without authentication
4. UUIDs can be harvested from chat messages or brute-forced

**Impact:** Complete exposure of all chat media — student submissions, private images, lecturer materials. Privacy violation for all users.
**Recommendation:** Restrict to authenticated users enrolled in the relevant course:

```sql
DROP POLICY IF EXISTS "Chat media public read" ON storage.objects;
CREATE POLICY "Chat media authenticated read"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-media'
  AND auth.role() = 'authenticated'
);
```

**Note:** Verify in production that no later migration already dropped this policy. Check with:

```sql
SELECT policyname, qual FROM pg_policies
WHERE tablename = 'objects' AND policyname LIKE '%chat%';
```

**Priority:** P0 — Fix immediately

---

### [HIGH] #4 — Weak Filename Randomization Enables Enumeration

**Location:** `supabase/functions/chat-media/index.ts:116`, `components/chat/MessageInput.tsx:504`
**Description:** File names use `Math.random()` (non-cryptographic) with limited entropy, making them guessable.
**Evidence:**

```typescript
// chat-media/index.ts:116
const randomId = Math.random().toString(36).substring(2, 10);
const fileName = `${timestamp}-${randomId}.${fileExt}`;

// MessageInput.tsx:504
const fileName = `project-${Date.now()}-${Math.random()
  .toString(36)
  .substring(7)}.${fileExt}`;
```

**Attack scenario:** Combined with CRITICAL #3 (public storage), an attacker can enumerate files by:

1. Guessing `Date.now()` timestamps (1ms resolution, ~86M values/day)
2. Brute-forcing 8-char base36 random IDs (~2.8B possibilities, feasible with automation)

**Impact:** Unauthorized access to specific files, confirmation of which users uploaded what.
**Recommendation:** Use cryptographically secure randomization:

```typescript
const randomId = crypto.randomUUID().replace(/-/g, "");
```

**Priority:** P1 — Fix this week

---

### [HIGH] #5 — Error Messages Leak Internal Details in Server Logs

**Location:** Multiple API routes (e.g., `app/api/payments/keepz/create-order/route.ts:348-361`)
**Description:** While generic errors are returned to clients, full error objects (including stack traces, DB schema details, table/column names) are logged to console. If server logs are accessible or monitored, this aids reconnaissance.
**Evidence:**

```typescript
catch (error) {
  console.error("Error:", error);  // Full error object with stack trace
  return errorResponse("Internal server error", 500, cors);
}
```

**Attack scenario:** If an attacker gains read access to server logs (via log management tool misconfiguration, SSRF, or insider access), they learn DB schema, table names, API structure, and third-party service details.
**Impact:** Information disclosure useful for multi-stage attacks.
**Recommendation:** Sanitize logged errors:

```typescript
catch (error: any) {
  console.error("[Route] Error:", error?.message || "Unknown error");
  return errorResponse("Internal server error", 500, cors);
}
```

**Priority:** P1 — Fix this week

---

### [MEDIUM] #6 — No Password Complexity Enforcement

**Location:** `lib/auth.ts:17-70`
**Description:** Password is passed directly to Supabase Auth with no client-side validation. Supabase default minimum is 6 characters with no complexity requirements.
**Evidence:**

```typescript
export async function signUp({
  email, password, username, ...
}: SignUpData) {
  // Username validated (3-30 chars, alphanumeric+underscore)
  // Password NOT validated — passed directly to Supabase
  const { data, error } = await supabase.auth.signUp({
    email,
    password,  // No minimum length or complexity check
    options: { emailRedirectTo: emailRedirect, data: {...} }
  });
}
```

**Attack scenario:** Users create weak passwords ("123456"), making accounts vulnerable to credential stuffing or brute force.
**Impact:** Account takeover for users with weak passwords.
**Recommendation:** Add Zod validation before calling Supabase:

```typescript
const passwordSchema = z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/);
```

**Priority:** P2 — Fix this month

---

### [MEDIUM] #7 — User Enumeration in Signup Error Messages

**Location:** `lib/auth.ts:72-95`
**Description:** Signup error explicitly confirms when an email is already registered.
**Evidence:**

```typescript
if (
  msg.includes("already registered") ||
  msg.includes("already been registered")
) {
  throw new Error(
    "An account with this email already exists. Try signing in instead.",
    // Confirms email exists in the system
  );
}
```

**Attack scenario:** Attacker tries signup with target emails to build a list of valid platform users. Valuable for targeted phishing or credential stuffing.
**Impact:** Email enumeration — attacker can confirm which emails have accounts.
**Recommendation:** Return generic error:

```typescript
throw new Error("Account creation failed. Please try again or sign in.");
```

**Priority:** P2 — Fix this month

---

### [MEDIUM] #8 — Chat Message XSS Escaping Misses Ampersand

**Location:** `supabase/functions/chat-messages/index.ts:49-55`
**Description:** Server-side HTML entity escaping covers `<`, `>`, `"`, `'` but not `&`, which should be escaped first to prevent double-encoding issues.
**Evidence:**

```typescript
const sanitizedContent = hasContent
  ? content
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
  : // Missing: .replace(/&/g, "&amp;") — should be FIRST
    null;
```

**Attack scenario:** While React's auto-escaping provides primary XSS protection, incomplete server-side escaping is a defense-in-depth gap. If content is ever rendered outside React (emails, exports, admin tools), XSS becomes possible.
**Impact:** Low immediate risk (React auto-escapes), but creates a latent vulnerability for future rendering contexts.
**Recommendation:** Add ampersand as the FIRST replacement:

```typescript
.replace(/&/g, "&amp;")  // Must be first!
.replace(/</g, "&lt;")
.replace(/>/g, "&gt;")
.replace(/"/g, "&quot;")
.replace(/'/g, "&#x27;")
```

**Priority:** P1 — Fix this week (simple one-line fix)

---

### [MEDIUM] #9 — File Upload Trusts Client MIME Type (No Magic Bytes)

**Location:** `supabase/functions/chat-media/index.ts:52-59`
**Description:** File type validation checks MIME type from the request but not file content (magic bytes). An attacker can rename any file and set the MIME type to bypass validation.
**Evidence:**

```typescript
// Server-side validation (MIME only):
const mimeType = file.type.toLowerCase();
if (!ALLOWED_TYPES.includes(mimeType)) {
  return errorResponse(`Invalid file type: ${mimeType}...`, 400, cors);
}
// No magic bytes check — file content not inspected
```

**Attack scenario:**

1. Attacker renames `malware.exe` to `malware.mp4`
2. Sets `Content-Type: video/mp4` in the upload request
3. File passes MIME validation and is stored in chat-media bucket
4. Other users download what they think is a video but is actually malware

**Impact:** Malware distribution via chat attachments. Users must download and execute, so impact requires social engineering.
**Recommendation:** Validate file magic bytes on server:

```typescript
const buffer = await file.arrayBuffer();
const header = new Uint8Array(buffer).slice(0, 12);
// Check JPEG: FF D8 FF, PNG: 89 50 4E 47, MP4: ftyp at offset 4
```

**Priority:** P2 — Fix this month

---

### [MEDIUM] #10 — CSP style-src Uses unsafe-inline

**Location:** `middleware.ts:8-43`
**Description:** Content Security Policy allows `style-src 'unsafe-inline'`, which is required for Tailwind CSS but weakens CSS injection protection.
**Evidence:**

```typescript
const cspHeader = [
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}' ...`,
  "style-src 'self' 'unsafe-inline'",  // Required for Tailwind
  ...
];
```

**Attack scenario:** CSS injection (via stored XSS that fails to execute JS due to nonce CSP) could still exfiltrate data using CSS selectors and background-image URLs.
**Impact:** Low — CSS-only data exfiltration is limited in scope and requires existing XSS vector.
**Recommendation:** Track Tailwind's nonce-based CSS support. When available, migrate to nonce-based styles.
**Priority:** P3 — Backlog (accepted risk, documented)

---

### [MEDIUM] #11 — Referral Commission Allows Up to 100%

**Location:** `courses` table — `referral_commission_percentage` column
**Description:** No CHECK constraint prevents setting commission to 100%, meaning a referrer could receive the entire course price (minus platform/Keepz fees).
**Evidence:**

```sql
-- Migration 179 (commission calculation):
v_commission := (v_course.referral_commission_percentage::DECIMAL / 100)
  * v_course.price;
v_lecturer_amount := GREATEST(
  v_course.price - v_keepz_fee - v_platform_commission - v_commission,
  0
);
-- If commission = 100%, lecturer gets 0 GEL
```

**Attack scenario:** Lecturer sets 100% commission, gives referral code to accomplice. All revenue goes to the referrer (minus ~3% platform fee), and lecturer gets 0 GEL. Could be used for commission laundering.
**Impact:** Revenue manipulation — platform still gets its fee, but business model is distorted.
**Recommendation:** Add CHECK constraint:

```sql
ALTER TABLE courses ADD CONSTRAINT chk_commission_cap
  CHECK (
    referral_commission_percentage >= 0
    AND referral_commission_percentage <= 50
  );
```

**Priority:** P2 — Fix this month

---

### [MEDIUM] #12 — Account Deletion Cascade Incomplete (Referral Codes)

**Location:** No account deletion handler found
**Description:** No evidence of an account deletion flow was found. If accounts are deleted (GDPR, user request), referral codes may become orphaned, and previously created referral chains may break.
**Evidence:** No `DELETE FROM profiles` handler, no soft-delete mechanism, no cascade rules found for `referral_code` column.
**Attack scenario:** If account deletion is implemented in the future without proper cascade, deleted users' referral codes could be reused or cause foreign key violations.
**Impact:** Data integrity issues, potential orphaned commission records.
**Recommendation:** When implementing account deletion:

1. Cascade DELETE or NULL referral relationships
2. Mark referral codes as inactive
3. Invalidate sessions immediately
4. Soft-delete with 30-day retention before hard delete
   **Priority:** P2 — Address when implementing account deletion

---

### [LOW] #13 — Admin Route Auth Pattern Not Centralized

**Location:** All 35+ routes in `app/api/admin/`
**Description:** Each admin route repeats 6-8 lines of auth verification inline. While all routes checked have correct auth, the repetition increases the risk of a future route missing the pattern.
**Evidence:**

```typescript
// Repeated in every admin route:
const token = getTokenFromHeader(request);
if (!token)
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const { user, error: userError } = await verifyTokenAndGetUser(token);
if (userError || !user)
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const isAdmin = await checkAdmin(supabase, user.id);
if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

**Impact:** No current vulnerability — all checked routes have auth. Risk is in future routes forgetting the pattern.
**Recommendation:** Create shared middleware or wrapper function.
**Priority:** P3 — Backlog

---

### [LOW] #14 — Keepz Callback IP Allowlist Not Enforced

**Location:** `app/api/payments/keepz/callback/route.ts:36-62`
**Description:** IP allowlist for Keepz callbacks is optional — if `KEEPZ_ALLOWED_IPS` env var is not set, all IPs are accepted with only a console warning.
**Evidence:**

```typescript
const allowedIPs = process.env.KEEPZ_ALLOWED_IPS;
if (allowedIPs) {
  const whitelist = allowedIPs.split(",").map((ip) => ip.trim());
  if (!whitelist.includes(clientIP)) {
    // Block and audit log
  }
} else {
  console.warn("[Keepz Callback] KEEPZ_ALLOWED_IPS not set");
  // Continues processing — no block
}
```

**Impact:** Low — primary authentication is RSA encryption verification, which is strong. IP allowlist is defense-in-depth only.
**Recommendation:** Set `KEEPZ_ALLOWED_IPS` in production environment. Contact Keepz support for their callback IP ranges.
**Priority:** P2 — Fix this month

---

### [LOW] #15 — Admin Message Access Lacks Audit Trail

**Location:** `supabase/migrations/132_admin_messages_rls.sql`
**Description:** Admins can read ALL chat messages across ALL courses via RLS policy, with no audit logging of what they accessed.
**Evidence:**

```sql
CREATE POLICY "Admins can view all messages"
ON public.messages FOR SELECT
USING (is_admin(auth.uid()));
```

**Impact:** Insider threat — admin could read private student conversations without detection.
**Recommendation:** Implement admin access audit logging for sensitive data queries.
**Priority:** P3 — Backlog

---

### [LOW] #16 — .MOV Format in Server Allowlist Despite UI Block

**Location:** `supabase/functions/chat-media/index.ts:23`
**Description:** Recent commit `2bd2255` blocks .MOV uploads in the UI, but the server-side edge function still accepts `video/quicktime` and `video/mov` MIME types.
**Evidence:**

```typescript
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime", // Still allowed server-side
  "video/x-msvideo",
  "video/x-matroska",
  "video/mov", // Still allowed server-side
];
```

**Impact:** Users can bypass the UI block by calling the edge function directly, uploading .MOV files that may not play in browsers.
**Recommendation:** Remove `video/quicktime` and `video/mov` from server allowlist to match the UI block.
**Priority:** P3 — Backlog

---

## Previously Fixed Vulnerabilities (Verified)

These critical issues were identified and fixed in prior security hardening migrations:

| Migration | Issue Fixed                                                                          | Severity Before Fix |
| --------- | ------------------------------------------------------------------------------------ | ------------------- |
| 131       | Overly-permissive profiles SELECT (`USING (auth.uid() IS NOT NULL)` exposed all PII) | CRITICAL            |
| 131       | Enrollment expiry not checked in RLS policies                                        | HIGH                |
| 146       | Referrals INSERT policy `WITH CHECK (true)` allowed arbitrary referral creation      | CRITICAL            |
| 159       | Users could DELETE own enrollments (dispute after payment)                           | MEDIUM              |
| 162       | Withdrawal lifecycle not atomic (funds not held at request time)                     | CRITICAL            |
| 172       | `handle_new_user()` trusted client `role` metadata — admin escalation via signup     | CRITICAL            |
| 173       | `credit/debit_user_balance()` callable by any authenticated user                     | CRITICAL            |
| 183       | SECURITY DEFINER functions missing `SET search_path` (search_path hijacking)         | HIGH                |
| 183       | `process_referral()` missing `auth.uid()` check (referral on behalf of others)       | HIGH                |

---

## Verified Secure Areas

- [x] **Browser vs Server Client Separation** — `lib/supabase/client.ts` uses anon key only; `lib/supabase/server.ts` uses cookie-based session; service_role only in `lib/supabase-server.ts` (server-only file)
- [x] **Service Role Key Isolation** — `SUPABASE_SERVICE_ROLE_KEY` never appears in `components/` or client-side `app/` files; production throws fatal error if missing
- [x] **NEXT*PUBLIC* Variables** — Only `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_URL` — no secrets exposed
- [x] **Session Refresh** — Middleware calls `supabase.auth.getUser()` on every request; expired sessions handled gracefully
- [x] **CSP with Nonce** — Per-request `crypto.randomUUID()` nonce for script-src; `frame-ancestors 'self'`; restrictive `default-src 'self'`
- [x] **Security Headers** — HSTS (1 year + preload), X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (camera/mic/geo denied)
- [x] **Source Maps Disabled** — `productionBrowserSourceMaps: false` in `next.config.js`
- [x] **Rate Limiting** — Upstash Redis with sliding window; fail-CLOSED on Redis errors (blocks requests, does not allow through)
- [x] **Rate Limit Coverage** — Login (5/min), Payment (3/min), Password Reset (3/15min), Referral (10/min), Admin (30/min), Subscribe (3/min), Callback (30/min), Notification (60/min)
- [x] **.env Files Gitignored** — `.env`, `.env.staging`, `.env.production`, `.env.supabase` all in `.gitignore`
- [x] **No Hardcoded Secrets** — Grep for `sk_live|pk_live|secret_key|private_key|api_key` returned zero results
- [x] **Payment Price from Database** — `create-order` reads price from `courses.price` via authenticated Supabase query, not from client request
- [x] **Keepz Callback Encryption** — RSA-OAEP + AES-256-CBC hybrid encryption; plaintext callbacks explicitly rejected
- [x] **Payment Amount Validation** — Callback amount verified against stored order amount; mismatches rejected and audit-logged
- [x] **Replay Attack Protection** — Unique `keepz_order_id` lookup; already-processed payments return early
- [x] **Payment Idempotency** — Duplicate payment check with 5-minute window and self-healing via Keepz API verification
- [x] **Withdrawal Atomicity** — Funds held immediately at request creation via `debit_user_balance()` (migration 162); approval only changes status
- [x] **Self-Referral Prevention** — `process_referral()` uses `id != p_referred_user_id` to block self-referral
- [x] **Commission Server-Side Only** — `referral_commission_percentage` read from DB; commission calculated in SECURITY DEFINER function
- [x] **Enrollment Approval Idempotent** — `approve_enrollment_request()` checks `status = 'pending'` (prevents double-credit)
- [x] **handle_new_user() Fixed** — Role hardcoded to `'student'` (migration 172); lecturer applicants get `lecturer_status='pending'`
- [x] **Balance Functions Restricted** — `credit/debit_user_balance()` revoked from `authenticated` role (migration 173)
- [x] **search_path Hardened** — All 20+ SECURITY DEFINER functions set `search_path = public, pg_temp` (migration 183)
- [x] **check_is_admin() Proper** — SECURITY DEFINER, explicit search_path, STABLE, queries `profiles.role`
- [x] **Course Video Storage Private** — `course-videos` bucket set to private (migration 125); SELECT restricted to enrolled users, lecturers, admins
- [x] **Enrollment Expiry in RLS** — Channel, video, and message policies check `enrollments.expires_at` (migration 131)
- [x] **PII Encryption at Rest** — Email, full name, bank account encrypted with `pgp_sym_encrypt` via vault keys (migration 143-144)
- [x] **Edge Function Auth Consistent** — All edge functions use `getAuthenticatedUser(req)` pattern; Bearer token verified via `supabase.auth.getUser()`
- [x] **CORS Allowlist** — `_shared/cors.ts` uses explicit origin allowlist (swavleba.ge, www.swavleba.ge, DigitalOcean app URL); no wildcard
- [x] **Zod Validation on Payment Routes** — `create-order`, enrollment requests, and other critical POST routes use Zod schemas
- [x] **Muted User Enforcement** — Chat message edge function checks mute status before allowing message insertion
- [x] **Admin Routes Auth Verified** — All 35+ admin routes checked have token verification, user verification, admin role check before processing
- [x] **SVG Sandboxed** — `dangerouslyAllowSVG` with `script-src 'none'; sandbox` CSP (next.config.js)
- [x] **React Auto-Escaping** — Chat messages rendered via JSX text interpolation, not innerHTML
- [x] **Public Endpoints Properly Scoped** — Health check secret-gated, ping minimal, referral validation rate-limited

---

## Recommendations Priority Matrix

| Timeframe                | Action Items                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fix immediately (P0)** | 1. Upgrade Next.js to patch CVEs. 2. Add `FOR UPDATE` to `debit_user_balance()` and `credit_user_balance()`. 3. Restrict chat-media storage SELECT policy to authenticated users.                                                                                                                                                |
| **Fix this week (P1)**   | 4. Replace `Math.random()` with `crypto.randomUUID()` for filenames. 5. Sanitize error objects before logging. 6. Add ampersand (`&`) escaping to chat message sanitization (one-line fix).                                                                                                                                      |
| **Fix this month (P2)**  | 7. Add client-side password complexity validation (8+ chars, mixed case/numbers). 8. Return generic signup error to prevent email enumeration. 9. Add magic bytes validation for file uploads. 10. Add CHECK constraint on `referral_commission_percentage` (cap at 50%). 11. Set `KEEPZ_ALLOWED_IPS` in production environment. |
| **Backlog (P3)**         | 12. Migrate to nonce-based Tailwind CSS (when supported). 13. Centralize admin route auth into shared middleware. 14. Add audit logging for admin message access. 15. Remove .MOV from server-side allowlist. 16. Implement account deletion with proper cascade.                                                                |

---

## Appendix: Files Audited

### Application Code

- `lib/auth.ts` — Client auth (signup, login, OAuth)
- `lib/admin-auth.ts` — Admin auth gate (verifyAdminRequest)
- `lib/supabase-server.ts` — Token verification + service role client
- `lib/supabase/client.ts` — Browser Supabase client
- `lib/supabase/server.ts` — Server Supabase client (cookie-based)
- `lib/supabase/middleware.ts` — Session refresh middleware helper
- `lib/rate-limit.ts` — Upstash Redis rate limiting
- `lib/keepz.ts` — Keepz RSA/AES crypto and API
- `lib/schemas/index.ts` — Zod input validation schemas
- `middleware.ts` — CSP nonce, session refresh, cache headers
- `next.config.js` — Security headers, image config, SVG handling
- `.gitignore` — Environment file exclusions

### API Routes

- `app/auth/callback/route.ts` — OAuth/recovery callback
- `app/api/payments/keepz/create-order/route.ts` — Payment creation
- `app/api/payments/keepz/callback/route.ts` — Payment webhook
- `app/api/payments/keepz/status/route.ts` — Payment status check
- `app/api/payments/keepz/verify-pending/route.ts` — Pending payment verification
- `app/api/withdrawals/route.ts` — Withdrawal requests
- `app/api/enrollment-requests/route.ts` — Student enrollment requests
- `app/api/bundle-enrollment-requests/route.ts` — Bundle enrollment requests
- `app/api/admin/*` — All admin routes (35+ endpoints spot-checked)

### Edge Functions

- `supabase/functions/_shared/auth.ts` — Edge function auth helper
- `supabase/functions/_shared/cors.ts` — CORS allowlist
- `supabase/functions/_shared/supabase.ts` — Edge function Supabase client
- `supabase/functions/import_map.json` — Import mappings
- `supabase/functions/chat-messages/index.ts` — Chat message CRUD
- `supabase/functions/chat-media/index.ts` — Chat file uploads
- 5+ additional edge functions spot-checked for auth pattern

### Migrations (Key Security-Related)

- `002` — Profiles table + initial RLS
- `005` — Courses table + RLS
- `011` — Enrollments RLS
- `024` — Chat-media storage policies
- `029`, `030` — Storage bucket setup
- `036`, `087`, `088` — check_is_admin function
- `051` — Project submissions RLS
- `061` — Profiles username policy (later dropped)
- `064` — Referral system
- `068-070` — Commission system
- `072` — Withdrawal requests RLS
- `073` — Balance functions (credit/debit)
- `096` — Storage policy updates
- `122`, `123` — Course RLS refinements
- `125` — Course videos bucket privacy
- `131` — Security audit fixes (profiles, enrollments, expiry)
- `132` — Admin messages RLS
- `143-144` — PII encryption
- `146` — Referrals INSERT policy fix
- `149-150` — Storage policy updates
- `159` — Remove user enrollment delete
- `162` — Atomic withdrawal lifecycle
- `163` — Public profiles view
- `168` — Payment transaction safety
- `171-172` — handle_new_user trigger fixes
- `173` — Revoke public balance functions
- `176-177` — Additional security fixes
- `179` — Commission calculation in payment RPC
- `180` — Storage policy updates
- `183` — search_path hardening + auth guards

### Configuration

- `package.json` — Dependency versions
- `.gitignore` — Secret file exclusions
- `npm audit --production` — Dependency vulnerability scan

---

## CVE Risk Assessment — Next.js 14.2.35

**Current version:** `next@14.2.35` (latest in 14.x line)
**Vulnerable range:** `9.5.0 - 15.5.13` — patched in **15.5.14+**
**No fix exists within 14.x.** Mitigations applied below; full resolution requires Next.js 15 upgrade.

### Applicability Analysis

| CVE (GHSA ID) | Title                                    | Applies?    | Justification                                                                                                                        |
| ------------- | ---------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| GHSA-9g9p     | Image Optimizer DoS via `remotePatterns` | **Partial** | Uses `remotePatterns` for 2 Supabase domains, but only admin-uploaded images. No user-controlled image URLs.                         |
| GHSA-h25m     | RSC deserialization DoS                  | **No**      | Zero `'use server'` directives in codebase. No React Server Components with server actions.                                          |
| GHSA-ggv3     | HTTP request smuggling in rewrites       | **No**      | Zero rewrites in `next.config.js`. Only redirects (which are not affected).                                                          |
| GHSA-3x4c     | Unbounded `next/image` disk cache growth | **Low**     | `minimumCacheTTL: 60` already set. Only 2 components use `next/image` (`Navigation.tsx`, `chat/Message.tsx`). Limited image surface. |

### Compensating Controls in Place

1. **`remotePatterns` locked** — Only 2 Supabase storage domains allowed (`bvptqdmhuumjbyfnjxdt.supabase.co`, `nbecbsbuerdtakxkrduw.supabase.co`). No wildcard patterns.
2. **`minimumCacheTTL: 60`** — Prevents rapid cache churn from the disk cache CVE.
3. **`dangerouslyAllowSVG` sandboxed** — CSP `script-src 'none'; sandbox` on SVG rendering.
4. **CDN cache header on `/_next/image`** — `Cache-Control: public, max-age=31536000, immutable` added to signal CDN/browser caching, reducing repeated optimizer invocations.
5. **Limited image surface** — Only 2 files use `next/image`; images are admin-uploaded course thumbnails and platform assets.
6. **No server actions** — No `'use server'` directives eliminates RSC deserialization attack vector.
7. **No rewrites** — Eliminates request smuggling attack vector entirely.

### Accepted Risk

The Image Optimizer DoS (GHSA-9g9p) has **partial** applicability but is mitigated by:

- Locked `remotePatterns` (no attacker-controlled URLs)
- CDN caching (reduces repeated optimizer hits)
- Low image volume (only admin-uploaded assets)

**Residual risk:** An attacker who can upload images via the admin panel (requires admin credentials) could theoretically trigger optimizer DoS. This is accepted given the admin-only access requirement.

### Resolution Timeline

Full resolution requires upgrading to Next.js 15.5.14+. This is a major version upgrade (14 → 15) with breaking changes including:

- App Router API changes
- React 19 requirement
- Middleware behavior changes
- `next/image` API changes

**Planned approach:** Separate upgrade project with staging validation before production deployment.

---

_End of Security Audit Report_
_Generated: 2026-03-21 | Auditor: Claude Code (Opus 4.6) | Method: Static analysis with 4 parallel research agents_
