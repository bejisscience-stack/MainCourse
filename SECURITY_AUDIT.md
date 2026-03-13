# Security Audit — Swavleba (MainCourse)

**Date**: 2026-03-13
**Auditor**: Claude Code (Opus 4.6)
**Scope**: Full codebase — auth, RLS, input validation, payment callbacks, secrets, XSS, redirects, CSP, CORS, rate limiting, error leaking, business logic, npm vulnerabilities, storage, and role enforcement
**Prior Work**: SEC-01 through SEC-16 fixes already applied (see recent commits)

---

## Overall Rating: 8.2 / 10

| Severity  | Count  |
| --------- | ------ |
| CRITICAL  | 0      |
| HIGH      | 4      |
| MEDIUM    | 5      |
| LOW       | 4      |
| **Total** | **13** |

---

## Top 5 Urgent Items

1. **HIGH** — Storage: `chat-media` bucket SELECT policy has `true` fallback (any auth user sees all media)
2. **HIGH** — Storage: `payment-screenshots` bucket has universal SELECT policy (any auth user sees all screenshots)
3. **HIGH** — npm: Next.js `14.x` has 1 high-severity DoS vulnerability (GHSA-9g9p, GHSA-h25m)
4. **HIGH** — Debug code: `MessageInput.tsx:194` has hardcoded fetch to localhost debug endpoint left in code
5. **MEDIUM** — Error leaking: `admin/project-subscriptions/route.ts:48` returns raw `subsError.message` to client

---

## Properly Secured (What's Good)

- **Auth**: Bearer token verification on all 45+ protected routes via `verifyTokenAndGetUser`
- **RLS**: All 34 tables have Row Level Security enabled with appropriate policies
- **SQL Injection**: Zero raw SQL; all queries use parameterized Supabase client
- **CORS**: No wildcard origins; conditional localhost only in non-production
- **Open Redirects**: `validateRedirectUrl()` blocks `//`, `\`, and absolute URLs
- **Payment Security**: RSA-2048 OAEP + AES-256-CBC encrypted callbacks, amount validation, `FOR UPDATE` locking, idempotency
- **XSS Prevention**: No rendering of unsanitized user HTML; nonce-based CSP for scripts
- **Security Headers**: HSTS (1yr), X-Frame-Options, X-Content-Type-Options, CSP, Permissions-Policy
- **Rate Limiting**: Redis-backed (Upstash) on critical endpoints (login 5/60s, payment 3/60s, referral 10/60s, admin 30/60s)
- **Session**: httpOnly + Secure + SameSite=Lax cookies, automatic refresh via supabase/ssr
- **Input Validation**: Strict regex on usernames, IBANs, emails, referral codes
- **Role Enforcement**: Admin via `check_is_admin` RPC, lecturer via `courses.lecturer_id`, enrollment checks
- **Timing-Safe Comparison**: Used for team access key validation in middleware
- **Audit Logging**: Admin actions + payment events logged to `audit_log` and `payment_audit_log`
- **Secrets**: `.env.local` and `.env.staging` are NOT tracked in git (confirmed via `git ls-files`)

---

## Detailed Findings

### HIGH-001: Chat Media Storage — Universal SELECT Policy

| Field        | Value                                                          |
| ------------ | -------------------------------------------------------------- |
| **Severity** | HIGH                                                           |
| **File**     | `supabase/migrations/023_create_chat_media_bucket.sql:113-136` |
| **Category** | Storage / Access Control                                       |

**Description**: The SELECT policy for the `chat-media` bucket includes a `true` fallback condition at line 134. This negates the enrollment and lecturer checks above it, allowing any authenticated user to view chat media files from any course.

**Impact**: Authenticated users can access private chat media (images, files) from courses they are not enrolled in. This bypasses the enrollment-based access control that protects course content.

**Recommendation**: Remove the `true` fallback from the SELECT policy. The policy should only allow access through:

- Enrollment check: user is enrolled in the course the media belongs to
- Lecturer check: user is the lecturer of the course
- Admin check: user is an admin

---

### HIGH-002: Payment Screenshots — Universal SELECT Policy

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| **Severity** | HIGH                                                                  |
| **File**     | `supabase/migrations/030_create_payment_screenshots_bucket.sql:51-54` |
| **Category** | Storage / Access Control                                              |

**Description**: The SELECT policy on the `payment-screenshots` bucket uses `USING (bucket_id = 'payment-screenshots')` with no user or role restriction. Any authenticated user can view any other user's payment proof screenshots.

**Impact**: Payment screenshots may contain sensitive financial information (bank details, transaction amounts, personal identifiers). Universal read access is a privacy violation.

**Recommendation**: Restrict SELECT to:

- The user who uploaded the screenshot (`auth.uid() = owner`)
- The lecturer of the associated course
- Admin users

---

### HIGH-003: Next.js Vulnerability (npm audit)

| Field        | Value            |
| ------------ | ---------------- |
| **Severity** | HIGH             |
| **Package**  | `next@14.x`      |
| **Category** | Dependency / DoS |

**Description**: `npm audit` reports 1 high-severity finding affecting Next.js 14.x:

- **GHSA-9g9p-9gw9-jx7f**: Denial of Service via Image Optimizer
- **GHSA-h25m-26qc-wcjf**: Denial of Service via insecure RSC deserialization

**Impact**: Denial of Service potential on self-hosted deployments. An attacker could crash the application by sending crafted requests to the Image Optimizer or RSC endpoints.

**Recommendation**: Upgrade to the patched Next.js version that addresses these CVEs. Check `npm audit fix` or manually upgrade to the latest 14.x patch.

---

### HIGH-004: Debug Code Left in Production

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| **Severity** | HIGH                                   |
| **File**     | `components/chat/MessageInput.tsx:194` |
| **Category** | Code Hygiene / Information Disclosure  |

**Description**: A hardcoded `fetch` call to `http://127.0.0.1:7242/ingest/...` is present in the production code. This appears to be a debug/telemetry endpoint left in from development.

**Impact**:

- Unnecessary network call on every file upload attempt
- Exposes a debug session ID in the request URL
- Fails silently in production (no localhost listener), but adds latency
- Could be exploited if a user runs a local server on that port

**Recommendation**: Remove the debug fetch call entirely.

---

### MEDIUM-001: Error Message Leaking — Admin Project Subscriptions

| Field        | Value                                             |
| ------------ | ------------------------------------------------- |
| **Severity** | MEDIUM                                            |
| **File**     | `app/api/admin/project-subscriptions/route.ts:48` |
| **Category** | Information Disclosure                            |

**Description**: The error response returns `subsError.message` directly to the client in the JSON body. This can expose Supabase or PostgreSQL internal error messages.

**Impact**: While limited to admin-only routes, leaked database error messages can reveal schema details, constraint names, or internal logic that aids an attacker.

**Recommendation**: Return a generic error message to the client (e.g., `"Failed to fetch subscriptions"`). Log the detailed error server-side with `console.error`.

---

### MEDIUM-002: Missing Rate Limiting on Key Routes

| Field        | Value                            |
| ------------ | -------------------------------- |
| **Severity** | MEDIUM                           |
| **Category** | Rate Limiting / Abuse Prevention |

**Description**: Several mutation and sensitive GET endpoints lack rate limiting:

- `POST /api/enrollment-requests`
- `POST /api/withdrawals`
- `POST /api/bundle-enrollment-requests`
- `PATCH /api/profile`
- `POST /api/project-subscriptions`
- `GET /api/balance`

**Impact**: Authenticated users can spam enrollment/withdrawal/subscription requests. The profile endpoint could be used for username enumeration. The balance endpoint could be polled aggressively.

**Recommendation**: Add Upstash Redis rate limiters to all mutation endpoints and sensitive read endpoints. Suggested limits:

- Enrollment/withdrawal/subscription requests: 5 per 60 seconds
- Profile updates: 10 per 60 seconds
- Balance checks: 20 per 60 seconds

---

### MEDIUM-003: CSP style-src unsafe-inline

| Field        | Value                   |
| ------------ | ----------------------- |
| **Severity** | MEDIUM                  |
| **File**     | `middleware.ts:99`      |
| **Category** | Content Security Policy |

**Description**: The Content Security Policy includes `'unsafe-inline'` for `style-src`. This is required by Tailwind CSS for its utility-class-based styling approach.

**Impact**: CSS injection is theoretically possible, though significantly lower risk than script injection. An attacker could alter page appearance but not execute JavaScript via this vector alone.

**Recommendation**: Accepted risk given Tailwind CSS dependency. Track for future improvement — consider nonce-based style loading if Tailwind adds support.

---

### MEDIUM-004: Error Stack Traces Stored in payment_audit_log

| Field        | Value                                              |
| ------------ | -------------------------------------------------- |
| **Severity** | MEDIUM                                             |
| **File**     | `app/api/payments/keepz/callback/route.ts:356-360` |
| **Category** | Information Disclosure / Data Hygiene              |

**Description**: When payment callback processing fails, the full error stack trace is stored in the `payment_audit_log` table's detail field.

**Impact**: Stack traces contain internal file paths, function names, and line numbers. If the audit log is ever exposed (via admin UI, API leak, or database export), this reveals internal architecture details.

**Recommendation**: Store only sanitized error messages in the audit log (error name + message). Log full stack traces to server-side logging only (console or external log service).

---

### MEDIUM-005: Offensive Language in Local Config

| Field        | Value                                |
| ------------ | ------------------------------------ |
| **Severity** | MEDIUM                               |
| **File**     | `.env.local` (NOT tracked in git)    |
| **Category** | Professionalism / Secrets Management |

**Description**: The `TEAM_ACCESS_KEY` environment variable contains an offensive term. While this file is not committed to the repository, it exists on developer machines.

**Impact**: Professionalism concern. If the key is ever logged, displayed in an error message, or shared, it reflects poorly on the project.

**Recommendation**: Replace with a cryptographically random string (e.g., `openssl rand -hex 32`). Update in all environments.

---

### LOW-001: Admin GET Routes Lack Rate Limiting

| Field        | Value         |
| ------------ | ------------- |
| **Severity** | LOW           |
| **Category** | Rate Limiting |

**Description**: Admin-only GET/list endpoints (analytics, enrollment-requests list, withdrawals list, notifications send, etc.) do not have rate limiting applied.

**Impact**: A compromised admin account could be used to scrape all platform data rapidly. Low severity because admin accounts are trusted and few in number.

**Recommendation**: Add an admin-tier rate limiter (e.g., 60 requests per 60 seconds) to admin GET endpoints.

---

### LOW-002: No Virus/Malware Scanning on File Uploads

| Field        | Value                |
| ------------ | -------------------- |
| **Severity** | LOW                  |
| **Category** | File Upload Security |

**Description**: Files uploaded via chat media and payment screenshots are stored directly in Supabase Storage without virus or malware scanning.

**Impact**: Malicious files could be uploaded and stored. Since files are served with proper Content-Type headers and not executed server-side, direct exploitation is limited, but files could be used for social engineering.

**Recommendation**: Consider integrating ClamAV or a cloud-based malware scanning service (e.g., VirusTotal API) as a post-upload hook.

---

### LOW-003: No npm Security Scanning in CI/CD

| Field        | Value                 |
| ------------ | --------------------- |
| **Severity** | LOW                   |
| **Category** | DevOps / Supply Chain |

**Description**: The CI/CD pipeline does not include automated npm vulnerability scanning. Dependency vulnerabilities are only caught during manual `npm audit` runs.

**Recommendation**: Add `npm audit --audit-level=high` to the CI pipeline, or integrate Snyk/Dependabot for automated dependency monitoring and PR creation.

---

### LOW-004: Layout Uses Inline Script for Dark Mode

| Field        | Value                  |
| ------------ | ---------------------- |
| **Severity** | LOW                    |
| **File**     | `app/layout.tsx:111`   |
| **Category** | CSP / Script Injection |

**Description**: The root layout includes an inline `<script>` tag for dark mode initialization. The script is a hardcoded string (not user-controlled) and is protected by a CSP nonce.

**Impact**: Safe as implemented. The nonce prevents unauthorized inline scripts, and the content is static. Flagged for completeness only.

**Recommendation**: No action required. The nonce-based protection is correctly applied.

---

## Verification Methods

All findings were verified through:

- Direct file reads of source code, migrations, and configuration files
- `git ls-files` to confirm tracked/untracked file status
- `npm audit` output for dependency vulnerabilities
- Grep searches across the entire codebase for dangerous patterns (raw SQL, unsafe HTML rendering, hardcoded secrets, dynamic code execution, etc.)
- Review of all 34 table RLS policies via migration files
- Review of all Supabase storage bucket policies
- Review of middleware security headers and CSP configuration
- Review of all API route authentication patterns

---

## Notes

- This audit covers the codebase as of 2026-03-13 on the `staging` branch
- Prior SEC-01 through SEC-16 fixes have significantly improved the security posture
- No CRITICAL findings — the codebase demonstrates strong security practices overall
- The 4 HIGH findings are all actionable with straightforward fixes
