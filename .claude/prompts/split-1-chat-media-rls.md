# Agent 1: SEC-01 — Fix chat-media storage bucket SELECT bypass (CRITICAL)

## Priority: P0 — CRITICAL

## Problem

The `"Public can view chat media"` RLS policy on `storage.objects` has `OR true` at line 134 of migration `023_create_chat_media_bucket.sql`, making ALL chat attachments accessible to ANY authenticated user regardless of enrollment.

## Files to CREATE

- `supabase/migrations/130_fix_chat_media_select_policy.sql`

## Files NOT to touch (owned by other agents)

- `app/api/payments/keepz/callback/route.ts`
- `lib/rate-limit.ts`
- `lib/admin-auth.ts`
- `next.config.js`
- `app/api/notifications/` (any file)
- Any other migration file

## Implementation

Create `supabase/migrations/130_fix_chat_media_select_policy.sql` with:

```sql
-- SEC-01: Remove OR true bypass from chat-media SELECT policy
-- The original policy (migration 023) ended with OR true, making all chat media
-- accessible to any authenticated user regardless of enrollment.
-- This migration replaces it with proper enrollment/lecturer checks only.

DROP POLICY IF EXISTS "Public can view chat media" ON storage.objects;

CREATE POLICY "Enrolled users and lecturers can view chat media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-media' AND
  (
    -- User is enrolled in the course
    EXISTS (
      SELECT 1 FROM public.channels c
      JOIN public.enrollments e ON e.course_id = c.course_id
      WHERE c.id = (storage.foldername(name))[1]::uuid
      AND e.user_id = auth.uid()
    ) OR
    -- User is lecturer of the course
    EXISTS (
      SELECT 1 FROM public.channels c
      JOIN public.courses co ON co.id = c.course_id
      WHERE c.id = (storage.foldername(name))[1]::uuid
      AND co.lecturer_id = auth.uid()
    ) OR
    -- Admin users can view all chat media
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
);
```

## Verification

Run `npm run build`. Commit with message `security: fix chat-media storage SELECT bypass (SEC-01)`. Output DONE when build passes.
