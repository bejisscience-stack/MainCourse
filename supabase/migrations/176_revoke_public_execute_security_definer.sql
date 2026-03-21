-- Migration 176: REVOKE default PUBLIC execute on SECURITY DEFINER functions
--
-- PostgreSQL grants EXECUTE on all functions to PUBLIC by default.
-- For SECURITY DEFINER functions this is dangerous: they bypass RLS and run
-- as the function owner (postgres). Without REVOKE, unauthenticated (anon)
-- users can call these functions via PostgREST.
--
-- This migration removes PUBLIC and anon access from all 18 remaining
-- SECURITY DEFINER functions that were not already secured in migrations
-- 156/157/158/173/174/175.
--
-- Functions are grouped by access pattern:
--   Group A: Used in RLS policies — MUST remain accessible to authenticated
--   Group B: Called from API routes/client via user JWT — needs authenticated
--   Group C: Called only from edge functions via service_role — restrict to service_role
--
-- NOTE: 4 functions from the original 22-item audit were already DROPped:
--   is_admin()                          — dropped in mig 115
--   search_users(TEXT,UUID,INT)          — dropped in mig 140
--   cleanup_expired_typing_indicators()  — dropped in mig 115
--   get_profiles_for_friend_requests(UUID[]) — dropped in mig 049

-- ============================================================
-- Step 1: REVOKE default PUBLIC and anon execute from ALL 18 functions
-- ============================================================

-- Group A: Used in RLS policies (check_is_admin, has_project_access)
REVOKE ALL ON FUNCTION public.check_is_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_is_admin(UUID) FROM anon;

REVOKE ALL ON FUNCTION public.has_project_access(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_project_access(UUID) FROM anon;

-- Group B: Admin functions called from API routes with user JWT
REVOKE ALL ON FUNCTION public.approve_enrollment_request(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_enrollment_request(UUID) FROM anon;

REVOKE ALL ON FUNCTION public.reject_enrollment_request(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_enrollment_request(UUID) FROM anon;

REVOKE ALL ON FUNCTION public.approve_withdrawal_request(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_withdrawal_request(UUID, TEXT) FROM anon;

REVOKE ALL ON FUNCTION public.reject_withdrawal_request(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_withdrawal_request(UUID, TEXT) FROM anon;

REVOKE ALL ON FUNCTION public.approve_lecturer_account(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_lecturer_account(UUID) FROM anon;

REVOKE ALL ON FUNCTION public.reject_lecturer_account(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_lecturer_account(UUID, TEXT) FROM anon;

REVOKE ALL ON FUNCTION public.get_enrollment_requests_admin(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_enrollment_requests_admin(TEXT) FROM anon;

REVOKE ALL ON FUNCTION public.get_view_scraper_schedule() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_view_scraper_schedule() FROM anon;

REVOKE ALL ON FUNCTION public.update_view_scraper_schedule(TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_view_scraper_schedule(TEXT, BOOLEAN) FROM anon;

-- Group B: User-facing functions called from client/API routes
REVOKE ALL ON FUNCTION public.get_user_balance_info(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_balance_info(UUID) FROM anon;

REVOKE ALL ON FUNCTION public.get_safe_profiles(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_safe_profiles(UUID[]) FROM anon;

REVOKE ALL ON FUNCTION public.update_own_profile(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_own_profile(TEXT, TEXT) FROM anon;

REVOKE ALL ON FUNCTION public.create_referral_safe(TEXT, UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_referral_safe(TEXT, UUID, UUID, UUID) FROM anon;

REVOKE ALL ON FUNCTION public.create_withdrawal_request(DECIMAL, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_withdrawal_request(DECIMAL, TEXT) FROM anon;

REVOKE ALL ON FUNCTION public.mark_all_notifications_read(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_all_notifications_read(UUID) FROM anon;

REVOKE ALL ON FUNCTION public.get_unread_notification_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_unread_notification_count(UUID) FROM anon;

-- ============================================================
-- Step 2: GRANT execute to appropriate roles
-- ============================================================

-- Group A: RLS-referenced functions — must be callable by authenticated
-- (RLS policies evaluate in the context of the querying role)
GRANT EXECUTE ON FUNCTION public.check_is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_admin(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.has_project_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_project_access(UUID) TO service_role;

-- Group B: Admin functions — called from API routes (user JWT = authenticated)
-- Internal check_is_admin() prevents non-admin execution
GRANT EXECUTE ON FUNCTION public.approve_enrollment_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_enrollment_request(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.reject_enrollment_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_enrollment_request(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.approve_withdrawal_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal_request(UUID, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION public.reject_withdrawal_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal_request(UUID, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION public.approve_lecturer_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_lecturer_account(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.reject_lecturer_account(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_lecturer_account(UUID, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_enrollment_requests_admin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_enrollment_requests_admin(TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_view_scraper_schedule() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_view_scraper_schedule() TO service_role;

GRANT EXECUTE ON FUNCTION public.update_view_scraper_schedule(TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_view_scraper_schedule(TEXT, BOOLEAN) TO service_role;

-- Group B: User-facing functions — called from client components or API routes
-- Internal auth.uid() checks prevent cross-user access
GRANT EXECUTE ON FUNCTION public.get_user_balance_info(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_balance_info(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_safe_profiles(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_safe_profiles(UUID[]) TO service_role;

GRANT EXECUTE ON FUNCTION public.update_own_profile(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_own_profile(TEXT, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION public.create_referral_safe(TEXT, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_referral_safe(TEXT, UUID, UUID, UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.create_withdrawal_request(DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_withdrawal_request(DECIMAL, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_unread_notification_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count(UUID) TO service_role;
