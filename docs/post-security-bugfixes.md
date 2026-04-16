# Post-Security Audit Bug Fixes

Date: 2026-03-14
Context: After security audit commits `c25e293`..`0e355f4`, several features broke.

---

## Bug #1: Home Page Video Not Playable

**Status**: FIXED

**Root Cause**: CSP in `middleware.ts` had no `media-src` directive. Per CSP spec, missing directives fall back to `default-src 'self'`, blocking videos from `*.supabase.co`.

**Fix**: Added `media-src 'self' blob: https://*.supabase.co https://*.supabase.in` to CSP directives in `middleware.ts:102`.

**Verified**: Console errors `Loading media from '...' not allowed` were visible on the home page before fix.

---

## Bug #2: "Save this card" Checkbox Not Checkable

**Status**: NOT A BUG

**Investigation**: Tested on staging with Playwright. The checkbox at `EnrollmentModal.tsx:896-907` toggles correctly. Clicked it on/off successfully. No CSP violations, no z-index overlaps, no `pointer-events: none` found in the modal structure.

`@tailwindcss/forms` is not installed, so the checkbox uses browser-default styling rather than Tailwind-styled appearance, but it is fully functional.

**Conclusion**: This was either a transient browser issue or a misreport. No code change needed.

---

## Bug #3: Pay Button Shows "An error occurred"

**Status**: FIXED

**Root Cause**: The rate limiter (`lib/rate-limit.ts`) crashes when Upstash Redis is not configured. The security audit added rate limiting (commit `39b26ef`) using `@upstash/ratelimit`. When `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are not set, the code passes a plain `Map` object as a Redis client:

```js
const redisOrMemory = hasRedis ? Redis.fromEnv() : new Map<string, number>();
```

`Map` does not implement the Redis command interface (`eval`, `evalsha`, etc.), so when `limiter.limit()` is called, it throws a generic `Error` (not a `KeepzError`). This is caught by the outer `catch` block in `create-order/route.ts:348-361` and returned as `{ error: "An error occurred" }` with status 500.

**Evidence**:

- Network tab showed `POST /api/payments/keepz/create-order => 500` (not 502, confirming non-KeepzError)
- No `keepz_payments` row was created (error happens at rate limiter, before DB insert)
- `GET /api/notifications/unread-count => 500` — same root cause, also uses rate limiter
- Enrollment request was created successfully (201) — the `/api/enrollment-requests` route does NOT use rate limiting

**Fix**: Wrapped `limiter.limit()` in a try-catch in `wrapLimiter()` (`lib/rate-limit.ts:50-76`). When Redis is unavailable, the rate limiter fails open (allows the request through) with a console warning.

**Also affects**: All API routes using rate limiters — notifications, payments, login, referrals, etc.

**Permanent fix needed**: Configure Upstash Redis on the DigitalOcean staging deployment, or remove the `@upstash/ratelimit` dependency in favor of a simpler in-memory rate limiter that doesn't require Redis.

---

## Bug #4: Remove Admin Enrollment/Withdrawal/Subscription Tabs

**Status**: FIXED

**What was done**: Removed 3 tabs from `app/admin/page.tsx` (2800 lines -> 506 lines):

- Enrollment Requests tab (course + bundle)
- Withdrawals tab
- Project Subscriptions tab

These are no longer needed because `complete_keepz_payment` RPC (migrations 111-129) auto-approves enrollments and activates project subscriptions upon successful Keepz payment callback.

**Remaining tabs**: Overview, View Bot, All Courses, Send Notifications, Analytics.

**TODO**: Automatic withdrawal processing is NOT implemented. See `docs/TODO-automatic-withdrawals.md` for the plan. Until then, withdrawals must be processed manually via Supabase Dashboard SQL.

---

## Bug #5: Chat Messages Not Visible for Admin

**Status**: FIXED (deployed to staging)

**Root Cause**: No admin RLS policy existed on the `messages` table. Channels and videos had admin policies (migrations 033/037), but messages were missed. The SEC-08 fix in migration 131 tightened enrollment-based policies further, making the gap more visible.

**Fix**: Migration `132_admin_messages_rls.sql` adds:

- `Admins can view all messages` (SELECT on `messages`)
- `Admins can insert messages` (INSERT on `messages`)
- `Admins can delete any message` (DELETE on `messages`)
- `Admins can view all message attachments` (SELECT on `message_attachments`)

Applied to staging via `mcp__supabase__apply_migration`.

---

## Bug #6: Single Video Shows Locked for Admin

**Status**: FIXED

**Root Cause**: `ChatArea.tsx:45` equated "not enrolled" with "enrollment expired":

```ts
const isEnrollmentExpired = !isEnrolledInCourse;
```

For admin users who access courses without being enrolled, `isEnrolledInCourse = false` -> `isEnrollmentExpired = true`, which locks all videos in `LecturesChannel.tsx:42-51`.

**Fix**: In `app/courses/[courseId]/chat/page.tsx:551`, changed:

```ts
isEnrolledInCourse = { isEnrolled };
```

to:

```ts
isEnrolledInCourse={isEnrolled || userRole === "admin"}
```

Admin is now treated as "enrolled" for content access purposes.

---

## Bonus: Notifications Endpoint Broken

**Status**: FIXED (same root cause as Bug #3)

`GET /api/notifications/unread-count` returns 500 on every poll (~every 30 seconds). Same rate limiter crash. The `wrapLimiter()` fix resolves this for all endpoints.

---

## Files Modified

| File                                             | Change                                          |
| ------------------------------------------------ | ----------------------------------------------- |
| `middleware.ts`                                  | Added `media-src` CSP directive                 |
| `lib/rate-limit.ts`                              | Try-catch in `wrapLimiter()` for Redis failures |
| `app/courses/[courseId]/chat/page.tsx`           | Admin treated as enrolled                       |
| `app/admin/page.tsx`                             | Removed 3 tabs (2800 -> 506 lines)              |
| `supabase/migrations/132_admin_messages_rls.sql` | Admin RLS on messages + attachments             |
| `docs/TODO-automatic-withdrawals.md`             | Created: withdrawal automation plan             |
