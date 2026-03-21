# Agent 7 — Frontend + API Route Fixes

**Priority:** HIGH + MEDIUM + LOW
**Findings:** HIGH-07, MED-01, MED-02, MED-10, LOW-01

## Files to MODIFY

- `app/api/payments/keepz/create-order/route.ts` (HIGH-07)
- `app/api/admin/withdrawals/[requestId]/reject/route.ts` (MED-01)
- `app/api/courses/[courseId]/video-url/route.ts` (MED-02)
- `app/api/admin/submissions/[id]/pay/route.ts` (MED-10)
- `components/chat/VideoSubmissionDialog.tsx` (LOW-01)
- `components/chat/SubmissionReviewDialog.tsx` (LOW-01)
- `app/courses/[courseId]/chat/page.tsx` (LOW-01)
- `app/admin/page.tsx` (LOW-01)

## Files to CREATE

- `supabase/migrations/183_video_enrollment_expiry_check.sql` (MED-02)

## Files you MUST NOT touch

All other files. Especially NOT: `lib/rate-limit.ts`, `lib/email-templates.ts`, `supabase/functions/*`, `components/EnrollmentModal.tsx`, `app/api/enrollment-requests/route.ts`, `app/api/withdrawals/route.ts`, `app/api/balance/route.ts`, `app/api/profile/route.ts`, `app/api/complete-profile/route.ts`, `app/api/account/delete/route.ts`.

## Tasks

### HIGH-07: Await audit log write in payment route

Read `app/api/payments/keepz/create-order/route.ts` fully.

Find the fire-and-forget pattern:

```typescript
adminSupabase
  .from("payment_audit_log")
  .insert({...})
  .then(() => {}, () => {});
```

**Fix:** Change to `await`:

```typescript
const { error: auditError } = await adminSupabase
  .from("payment_audit_log")
  .insert({...});

if (auditError) {
  console.error("Failed to write payment audit log:", auditError.message);
}
```

### MED-01: Implement withdrawal reject route

Read `app/api/admin/withdrawals/[requestId]/reject/route.ts` — it's empty (1 line).

Also read `app/api/admin/withdrawals/[requestId]/approve/route.ts` to understand the pattern.

Implement the reject route following the approve route pattern:

1. Extract `requestId` from `await params`
2. Verify admin via `verifyAdminRequest()` or `checkAdmin` RPC
3. Extract `reason` from request body (optional field)
4. Call `reject_withdrawal_request` RPC (instead of `approve_withdrawal_request`)
5. Create a rejection notification
6. Send rejection email using `sendWithdrawalRejectedEmail` (if the function exists — check `lib/email-templates.ts` for the template)
7. Return success response

### MED-02: Add enrollment expiry check to video-url route

Read `app/api/courses/[courseId]/video-url/route.ts` fully.

**Current issue:** The enrollment check queries:

```typescript
supabase
  .from("enrollments")
  .select("id")
  .eq("course_id", courseId)
  .eq("user_id", user.id);
```

This doesn't check `expires_at`.

**Fix:** Change the select to include `expires_at`:

```typescript
supabase
  .from("enrollments")
  .select("id, expires_at")
  .eq("course_id", courseId)
  .eq("user_id", user.id);
```

Then update the enrollment check:

```typescript
const enrollment = enrollmentResult.data;
const isEnrolled =
  !!enrollment &&
  (!enrollment.expires_at || new Date(enrollment.expires_at) > new Date());
```

**Also create migration** `supabase/migrations/183_video_enrollment_expiry_check.sql` to update the `course-videos` bucket RLS policy to check expiry:

```sql
-- Migration 183: Add enrollment expiry check to course-videos bucket RLS
-- Fixes: MED-02

-- Drop and recreate the select policy for course-videos bucket
-- Read the existing policy from migration 125 first to understand the current structure
-- Add: AND (e.expires_at IS NULL OR e.expires_at > NOW())
-- to the enrollment check condition
```

Read migration 125 (or whatever defines the course-videos bucket RLS) to get the exact current policy, then recreate it with the expiry check added. Follow the pattern from migration 149 (chat-media) which already has this check.

### MED-10: Fix params awaiting in submissions pay route

Read `app/api/admin/submissions/[id]/pay/route.ts`.

**Current:**

```typescript
{ params }: { params: { id: string } }
// ...
const submissionId = params.id;
```

**Fix:**

```typescript
{ params }: { params: Promise<{ id: string }> }
// ...
const { id: submissionId } = await params;
```

### LOW-01: Gate console.log statements with dev check

For each of these files:

- `components/chat/VideoSubmissionDialog.tsx` (lines ~138, 149)
- `components/chat/SubmissionReviewDialog.tsx` (line ~165)
- `app/courses/[courseId]/chat/page.tsx` (line ~425)
- `app/admin/page.tsx` (lines ~127, 143, 165)

Read each file, find `console.log` statements that log user IDs or sensitive data, and either:

1. Remove them if they're just debug logs
2. Or gate with: `if (process.env.NODE_ENV === 'development') console.log(...)`

Don't touch `console.error` statements — those are fine for production.

## Verification

Run `npm run build` to ensure no TypeScript compilation errors.

## Commit

```
fix: await audit logs, implement reject route, add video expiry check, fix params, gate console.logs
```

Output DONE when build passes.
