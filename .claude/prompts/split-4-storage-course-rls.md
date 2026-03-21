# Split 4: Storage + Course RLS Migrations (SEC-08, SEC-12, SEC-16, SEC-18)

## Scope

Create new SQL migration files to fix storage bucket policies and course/profile RLS. You ONLY create NEW files listed below.

## Files to Create

- `supabase/migrations/149_fix_chat_media_storage.sql`
- `supabase/migrations/150_courses_lecturer_approval.sql`
- `supabase/migrations/151_fix_profiles_rls_balance.sql`

## DO NOT Touch

- Any existing migration files
- Migration numbers 146-148 (Agent 3) or 152-155 (Agent 5)
- Any TypeScript files
- Any files outside `supabase/migrations/`

## Fixes

### SEC-08: Fix chat-media storage bucket public read (HIGH)

**File:** `supabase/migrations/149_fix_chat_media_storage.sql`

Replace the public read policy with an enrollment-based access policy. First read `supabase/migrations/024_fix_chat_media_storage_policies.sql` to understand existing policies, then:

1. Drop the `"Chat media public read"` policy on `storage.objects`
2. Create a new SELECT policy that checks:
   - User is authenticated AND
   - User is enrolled in the course (file path starts with `{courseId}/`) OR
   - User is the file owner (uploaded it) OR
   - User is a lecturer for the course OR
   - User is an admin

The chat-media file path structure is: `{courseId}/{channelId}/{userId}/{filename}`

```sql
-- Migration: Fix chat-media storage — replace public read with enrollment-based access

-- Drop overly permissive public read policy
DROP POLICY IF EXISTS "Chat media public read" ON storage.objects;

-- Authenticated users can read chat-media only if enrolled in the course
CREATE POLICY "Enrolled users can read chat media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-media'
  AND auth.role() = 'authenticated'
  AND (
    -- Check enrollment by extracting courseId from path (first segment)
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.user_id = auth.uid()
      AND e.course_id = (string_to_array(name, '/'))[1]::uuid
    )
    OR
    -- Lecturers who own the course
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.lecturer_id = auth.uid()
      AND c.id = (string_to_array(name, '/'))[1]::uuid
    )
    OR
    -- Admins
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
);
```

### SEC-12: Enforce lecturer approval on course creation (HIGH)

**File:** `supabase/migrations/150_courses_lecturer_approval.sql`

First read `supabase/migrations/123_restrict_courses_rls.sql` to see the current INSERT policy. Then:

1. Drop the existing `"Lecturers and admins can insert courses"` policy
2. Recreate it with `AND p.is_approved = true` for lecturers (admins bypass this check)

```sql
-- Migration: Enforce lecturer approval on course INSERT

DROP POLICY IF EXISTS "Lecturers and admins can insert courses" ON public.courses;

CREATE POLICY "Approved lecturers and admins can insert courses"
ON public.courses FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      (p.role = 'lecturer' AND p.is_approved = true)
      OR p.role = 'admin'
    )
  )
);
```

**IMPORTANT:** Read migration 123 first to match the exact existing policy structure and adapt accordingly.

### SEC-16 + SEC-18: Fix profiles RLS — hide balance, optimize joins (HIGH + MEDIUM)

**File:** `supabase/migrations/151_fix_profiles_rls_balance.sql`

First read `supabase/migrations/131_security_audit_fixes.sql` to understand the co-enrolled profiles policy. Then:

1. Create a `public_profiles` view that excludes sensitive columns (balance, bank details, encrypted PII)
2. Modify the co-enrolled profiles policy to restrict to approved lecturers only (optional — if too complex, just document)
3. Add a column-level security note via COMMENT

```sql
-- Migration: Fix profiles RLS — create public_profiles view, restrict balance visibility

-- Create a safe view for profile data visible to other users
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  id,
  username,
  full_name,
  avatar_url,
  role,
  referral_code,
  is_approved,
  created_at
FROM public.profiles;

-- Grant access to authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;

-- Add comment documenting that balance should never be exposed via co-enrolled policy
COMMENT ON COLUMN public.profiles.balance IS 'SENSITIVE: Never expose via co-enrolled or public profile queries. Use public_profiles view instead.';
```

## Completion

Run `npm run build`. If it passes, commit with message:

```
fix(security): storage + course RLS — enrollment-based media access, lecturer approval

SEC-08: Replace chat-media public read with enrollment-based access policy
SEC-12: Enforce is_approved=true for lecturers creating courses
SEC-16: Create public_profiles view to prevent balance exposure
SEC-18: Document balance column as sensitive
```

Output DONE when build passes.
