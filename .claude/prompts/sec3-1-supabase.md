Fix 6 security issues in Supabase layer only. Do NOT touch any files in app/api/ or next.config.js or middleware.ts.

FIX 1 — CRITICAL — Restrict courses INSERT/UPDATE RLS (RLS-01):
- Create new Supabase migration that drops the existing overly permissive INSERT and UPDATE policies on courses table
- Create new INSERT policy: only users with role 'lecturer' or 'admin' in profiles table can insert, and lecturer_id must equal auth.uid()
- Create new UPDATE policy: lecturers can only update their own courses (lecturer_id = auth.uid()), admins can update any course
- Do NOT change SELECT or DELETE policies
- Test logic: a student should NOT be able to insert or update any course

FIX 2 — HIGH — Fix edge function CORS wildcard (INFRA-01 + BIZ-03):
- In supabase/functions/_shared/cors.ts: replace Access-Control-Allow-Origin '*' with a function that checks origin against allowlist
- Allowed origins: https://swavleba.ge, https://www.swavleba.ge, https://plankton-app-wpsym.ondigitalocean.app, http://localhost:3000
- Return the matching origin in the header, or reject with no CORS header
- Remove x-scraper-secret from the shared Access-Control-Allow-Headers
- Update ALL edge functions that import corsHeaders to work with the new dynamic CORS
- Create a separate corsHeaders config for the view-scraper function that includes x-scraper-secret

FIX 3 — HIGH — Reinstate storage bucket file size limits (DATA-03):
- Create new Supabase migration that sets:
  - course-videos: file_size_limit = 10737418240 (10GB)
  - course-thumbnails: file_size_limit = 10485760 (10MB)
- This reverses the NULL limits set in migration 100

FIX 4 — MEDIUM — Fix edge function auth error leaking (AUTH-01):
- In supabase/functions/_shared/auth.ts line 54-57: replace authError?.message with generic "Unauthorized"
- Add console.error for the real error before returning
- Pattern: console.error('[Auth] Verification failed:', authError?.message); then return errorResponse('Unauthorized', 401)

FIX 5 — MEDIUM — Document course-videos public bucket risk (DATA-01):
- In the new migration file from FIX 3, add a SQL comment documenting that course-videos is public and URLs are guessable
- Add comment: -- TODO: Consider making course-videos private with signed URLs to prevent unauthorized access to paid content. See SECURITY_AUDIT.md DATA-01
- Do NOT change the bucket visibility in this task — it needs careful planning to avoid breaking video playback

FIX 6 — LOW — Fix .env.example gitignore (ENV-01):
- Add .env.example to .gitignore OR if it only contains placeholders, git add it intentionally
- If committing it: verify it contains ONLY placeholder values like "your-key-here", no real secrets

Run npm run build after changes. Commit with message "security: fix courses RLS, CORS, storage limits, edge auth (RLS-01, INFRA-01, DATA-03, AUTH-01)"

Output <promise>DONE</promise> when build passes.
