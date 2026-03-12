Make course-videos storage bucket private so paid content requires enrollment. This is a CRITICAL fix.

Do NOT touch: app/auth/, next.config.js, middleware.ts, lib/rate-limit.ts, lib/supabase-server.ts, lib/validation.ts, app/api/payments/keepz/callback/route.ts, any admin routes.

STEP 1 — Create Supabase migration to privatize course-videos bucket:
- UPDATE storage.buckets SET public = false WHERE id = 'course-videos'
- DROP the existing permissive SELECT policy "Public can view videos" on storage.objects
- CREATE new SELECT policy for enrolled users:
  CREATE POLICY "Enrolled users can view course videos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'course-videos'
    AND EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.user_id = auth.uid()
      AND enrollments.course_id = (storage.foldername(name))[1]::uuid
    )
  );
- Also create a policy for lecturers to access their own course videos:
  CREATE POLICY "Lecturers can view own course videos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'course-videos'
    AND EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.lecturer_id = auth.uid()
      AND courses.id = (storage.foldername(name))[1]::uuid
    )
  );
- Keep existing INSERT/UPDATE/DELETE policies for lecturers unchanged

STEP 2 — Create signed URL API endpoint:
- Create app/api/courses/[courseId]/video-url/route.ts
- GET handler: accepts videoPath query param
- Verify user is authenticated
- Verify user is enrolled in the course OR is the lecturer OR is admin
- If authorized: generate Supabase signed URL with 2 hour expiry
- If not: return 403
- Use createServiceRoleClient for signing (service role can sign private bucket URLs)

STEP 3 — Update video player to use signed URLs:
- Find all components that render course videos (search for course-videos in src/components, hooks, pages)
- Replace direct public URLs with calls to the new /api/courses/[courseId]/video-url endpoint
- The video player should fetch the signed URL on mount, then set it as the video source
- Handle loading state while URL is being fetched
- Handle expired URLs by re-fetching when video fails to load

Run npm run build after all changes. Commit with message "security: make course-videos private with signed URLs (DATA-01)"
Output <promise>DONE</promise> when build passes.
