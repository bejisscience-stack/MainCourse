# Staging Security Hardening Report (2026-04-16)

Project: `bvptqdmhuumjbyfnjxdt` (staging)

## Baseline Security Advisor Findings

Source: Supabase `get_advisors` (security), captured before any changes.

- `ERROR` `security_definer_view`: `public.active_services_view`
- `ERROR` `security_definer_view`: `public.public_profiles`
- `WARN` `rls_policy_always_true`: `public.coming_soon_emails` (`Allow anonymous insert`)
- `WARN` `public_bucket_allows_listing`: bucket `avatars`
- `WARN` `public_bucket_allows_listing`: bucket `course-thumbnails`
- `WARN` `auth_leaked_password_protection`: disabled
- `WARN` `function_search_path_mutable`: 19 functions

## Baseline Object Definitions

### Views

- `public.active_services_view`:
  - `SELECT id, name, description_en, description_ka, description_ru, photos, created_at, updated_at FROM services WHERE is_active = true ORDER BY name`
- `public.public_profiles`:
  - `SELECT id, username, avatar_url, role, referral_code, is_approved, created_at FROM profiles`

### Policies

- `public.coming_soon_emails`:
  - `Allow anonymous insert` (`INSERT`, `WITH CHECK (true)`)
  - `Allow admin select` (`SELECT`, admin role check)
- `storage.objects`:
  - `Public can view avatars` (`SELECT`, `bucket_id = 'avatars'`)
  - `Public can view thumbnails` (`SELECT`, `bucket_id = 'course-thumbnails'`)

### Function Search Path Findings

Flagged as mutable `search_path` at baseline:

- `accept_friend_request(request_id uuid, accepting_user uuid)`
- `are_friends(uid1 uuid, uid2 uuid)`
- `block_user_action(blocker uuid, target uuid)`
- `can_dm_user(sender uuid, receiver uuid)`
- `check_username_unique()`
- `cleanup_dm_typing()`
- `create_default_channels_for_course()`
- `get_decrypted_profile(p_user_id uuid)`
- `get_decrypted_profiles_by_referral(p_referral_codes text[])`
- `get_or_create_dm_channel(uid1 uuid, uid2 uuid)`
- `handle_updated_at()`
- `increment_dm_unread(p_channel_id uuid, p_user_id uuid)`
- `is_blocked(blocker uuid, blocked_user uuid)`
- `reset_dm_unread(p_channel_id uuid, p_user_id uuid)`
- `send_friend_request(sender uuid, receiver uuid)`
- `trigger_dm_message_unread()`
- `unfriend_user(uid uuid, friend uuid)`
- `update_unread_counts()`
- `update_unread_counts_on_video()`

## App Compatibility Scope Checked

Potentially impacted app paths reviewed before changes:

- `app/api/admin/notifications/send/route.ts`
- `components/AdminNotificationSender.tsx`
- `app/settings/page.tsx`
- `components/CourseCreationModal.tsx`
- `components/chat/LecturesChannel.tsx`
- `app/lecturer/dashboard/page.tsx`

## Change Log

- Baseline captured.
- Applied `197_set_security_invoker_for_public_views.sql`:
  - `ALTER VIEW public.public_profiles SET (security_invoker = true)`
  - `ALTER VIEW public.active_services_view SET (security_invoker = true)`
- Applied `198_harden_coming_soon_email_insert_policy.sql`:
  - Replaced `WITH CHECK (true)` with constrained email checks on anonymous insert policy.
- Applied `199_remove_broad_public_bucket_select_policies.sql`:
  - Dropped `storage.objects` policies `Public can view avatars` and `Public can view thumbnails`.
- Applied `200_set_search_path_for_chat_and_profile_functions.sql`:
  - Set `search_path = public, pg_temp` on all 19 functions flagged by advisor.

## Post-Change Verification

### Security Advisor (staging)

- Intermediate post-DB-change check returned only:
  - `WARN` `auth_leaked_password_protection`: disabled
- Final check after enabling leaked password protection:
  - `get_advisors` returned `[]` (no security findings)

All prior DB-level findings are cleared (`security_definer_view`, `function_search_path_mutable`, `rls_policy_always_true`, `public_bucket_allows_listing`, `auth_leaked_password_protection`).

### Object-level checks

- View options verified:
  - `public.public_profiles`: `security_invoker=true`
  - `public.active_services_view`: `security_invoker=true`
- Policy checks verified:
  - `coming_soon_emails.Allow anonymous insert` no longer uses `WITH CHECK (true)`
  - Broad storage listing policies removed for `avatars` and `course-thumbnails`
- Function checks verified:
  - All 19 targeted functions now have `proconfig = ['search_path=public, pg_temp']`

### Smoke checks run

- Anonymous insert policy behavior (`coming_soon_emails`):
  - `anon` insert with `staging_test_valid@example.com` succeeded in transaction.
  - `anon` insert with `bad email` was blocked by RLS policy.
- Storage listing behavior:
  - `anon` query over `storage.objects` for bucket `avatars` returned `0` rows.
- Public object rendering compatibility:
  - Sample staging avatar public URL returned `HTTP 200` with `content-type: image/png`.

## Auth Setting Note

Leaked password protection required a dashboard-level toggle (not exposed via the available DB migration tools). It was then enabled on staging and confirmed by a clean advisor result.
