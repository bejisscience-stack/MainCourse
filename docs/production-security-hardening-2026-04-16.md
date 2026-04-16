# Production Security Hardening Report (2026-04-16)

Project: `nbecbsbuerdtakxkrduw` (production)

## Baseline Findings

From `get_advisors` (security) before changes:

- `ERROR` `policy_exists_rls_disabled`: `public.services`
- `ERROR` `rls_disabled_in_public`: `public.services`
- `ERROR` `security_definer_view`: `public.public_profiles`
- `ERROR` `security_definer_view`: `public.active_services_view`
- `WARN` `function_search_path_mutable`: 14 functions
- `WARN` `rls_policy_always_true`: `public.coming_soon_emails` (`Allow anonymous insert`)
- `WARN` `public_bucket_allows_listing`: `avatars`
- `WARN` `public_bucket_allows_listing`: `course-thumbnails`
- `WARN` `public_bucket_allows_listing`: `service-images`
- `WARN` `auth_leaked_password_protection`: disabled

## Migration Applied

Applied to production via MCP migration tool:

- `supabase/migrations/201_production_security_alignment.sql`

Key changes:

- Set `security_invoker=true` for:
  - `public.public_profiles`
  - `public.active_services_view`
- Enabled RLS on `public.services`.
- Replaced `services` management policy with admin-only checks:
  - `USING (check_is_admin(auth.uid()))`
  - `WITH CHECK (check_is_admin(auth.uid()))`
- Preserved public active-read behavior on services:
  - `USING (is_active = true)`
- Replaced `coming_soon_emails` anonymous insert `WITH CHECK (true)` with constrained email checks.
- Dropped broad public listing policies on storage:
  - `Public can view avatars`
  - `Public can view thumbnails`
  - `Public can view service images`
- Set `search_path = public, pg_temp` on all 14 flagged functions.

## Verification

Post-change advisor result:

- Only remaining finding: `WARN` `auth_leaked_password_protection` (disabled)

Object and behavior checks:

- `public.services` now has `relrowsecurity = true`.
- `services` policies now:
  - `Admins can manage services` (admin-only via `check_is_admin(auth.uid())`)
  - `Public can view active services` (`is_active = true`)
- Both views now show `security_invoker=true`.
- As `anon`, direct listing queries on `storage.objects` for `avatars`, `course-thumbnails`, and `service-images` return `0`.
- Public object URL compatibility validated:
  - Sample avatar URL returns `HTTP 200`.
  - Sample course thumbnail URL returns `HTTP 200`.

## Remaining Manual Step

`Leaked Password Protection` still requires dashboard-level enablement (not exposed in DB migration tools).

After enabling it in Supabase dashboard for production, run `get_advisors` again to confirm zero findings.
