-- Migration 177: REVOKE default PUBLIC execute on remaining SECURITY DEFINER functions
--
-- Continuation of migration 176. The comprehensive scan found 24 additional
-- SECURITY DEFINER functions still callable by anon:
--   - 15 regular functions (callable via PostgREST RPC)
--   - 9 trigger functions (not callable via PostgREST, but best practice to revoke)
--
-- All regular functions use authenticated or service_role contexts in code.
-- 4 functions are unused/deprecated — restricted to service_role only.

-- ============================================================
-- Step 1: REVOKE from PUBLIC and anon — REGULAR FUNCTIONS (15)
-- ============================================================

-- Admin bundle enrollment functions
REVOKE ALL ON FUNCTION public.approve_bundle_enrollment_request(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_bundle_enrollment_request(UUID) FROM anon;

REVOKE ALL ON FUNCTION public.approve_bundle_enrollment_request(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_bundle_enrollment_request(UUID, UUID) FROM anon;

REVOKE ALL ON FUNCTION public.reject_bundle_enrollment_request(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_bundle_enrollment_request(UUID, UUID) FROM anon;

REVOKE ALL ON FUNCTION public.get_bundle_enrollment_requests_admin(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_bundle_enrollment_requests_admin(TEXT) FROM anon;

-- Admin project subscription functions
REVOKE ALL ON FUNCTION public.approve_project_subscription(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_project_subscription(UUID) FROM anon;

REVOKE ALL ON FUNCTION public.reject_project_subscription(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_project_subscription(UUID) FROM anon;

-- Admin query functions
REVOKE ALL ON FUNCTION public.get_enrollment_requests_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_enrollment_requests_count() FROM anon;

REVOKE ALL ON FUNCTION public.get_pending_lecturers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_pending_lecturers() FROM anon;

REVOKE ALL ON FUNCTION public.get_withdrawal_requests_admin(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_withdrawal_requests_admin(TEXT) FROM anon;

-- Referral processing functions
REVOKE ALL ON FUNCTION public.process_referral(TEXT, UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_referral(TEXT, UUID, UUID, UUID) FROM anon;

REVOKE ALL ON FUNCTION public.process_signup_referral_on_enrollment(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_signup_referral_on_enrollment(UUID, UUID, UUID) FROM anon;

-- Unused/internal functions — also revoke from authenticated
REVOKE ALL ON FUNCTION public.get_profiles_for_friends(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_profiles_for_friends(UUID[]) FROM anon;
REVOKE ALL ON FUNCTION public.get_profiles_for_friends(UUID[]) FROM authenticated;

REVOKE ALL ON FUNCTION public.insert_audit_log(UUID, TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.insert_audit_log(UUID, TEXT, TEXT, TEXT, JSONB, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.insert_audit_log(UUID, TEXT, TEXT, TEXT, JSONB, TEXT) FROM authenticated;

REVOKE ALL ON FUNCTION public.log_payment_event(UUID, UUID, UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_payment_event(UUID, UUID, UUID, TEXT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.log_payment_event(UUID, UUID, UUID, TEXT, JSONB) FROM authenticated;

REVOKE ALL ON FUNCTION public.search_users_by_email(TEXT, UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_users_by_email(TEXT, UUID, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.search_users_by_email(TEXT, UUID, INTEGER) FROM authenticated;

-- ============================================================
-- Step 2: REVOKE from PUBLIC and anon — TRIGGER FUNCTIONS (9)
-- (Not callable via PostgREST, but defense in depth)
-- ============================================================

REVOKE ALL ON FUNCTION public.auto_encrypt_pii() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_encrypt_pii() FROM anon;

REVOKE ALL ON FUNCTION public.cleanup_friend_request_on_unfriend() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_friend_request_on_unfriend() FROM anon;

REVOKE ALL ON FUNCTION public.create_default_channels_for_course() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_default_channels_for_course() FROM anon;

REVOKE ALL ON FUNCTION public.create_friendship_on_accept() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_friendship_on_accept() FROM anon;

REVOKE ALL ON FUNCTION public.delete_friendship_on_reject() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_friendship_on_reject() FROM anon;

REVOKE ALL ON FUNCTION public.encrypt_withdrawal_bank_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.encrypt_withdrawal_bank_account() FROM anon;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;

REVOKE ALL ON FUNCTION public.update_dm_conversation_last_message() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_dm_conversation_last_message() FROM anon;

REVOKE ALL ON FUNCTION public.update_unread_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_unread_counts() FROM anon;

-- ============================================================
-- Step 3: GRANT execute to appropriate roles
-- ============================================================

-- Admin functions called from API routes (user JWT = authenticated)
-- All have internal check_is_admin() guards
GRANT EXECUTE ON FUNCTION public.approve_bundle_enrollment_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_bundle_enrollment_request(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.approve_bundle_enrollment_request(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_bundle_enrollment_request(UUID, UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.reject_bundle_enrollment_request(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_bundle_enrollment_request(UUID, UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_bundle_enrollment_requests_admin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bundle_enrollment_requests_admin(TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION public.approve_project_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_project_subscription(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.reject_project_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_project_subscription(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_enrollment_requests_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_enrollment_requests_count() TO service_role;

GRANT EXECUTE ON FUNCTION public.get_pending_lecturers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_lecturers() TO service_role;

GRANT EXECUTE ON FUNCTION public.get_withdrawal_requests_admin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_withdrawal_requests_admin(TEXT) TO service_role;

-- Referral functions — called from API routes/edge functions with user JWT
GRANT EXECUTE ON FUNCTION public.process_referral(TEXT, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_referral(TEXT, UUID, UUID, UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.process_signup_referral_on_enrollment(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_signup_referral_on_enrollment(UUID, UUID, UUID) TO service_role;

-- Unused/internal functions — service_role only
GRANT EXECUTE ON FUNCTION public.get_profiles_for_friends(UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_audit_log(UUID, TEXT, TEXT, TEXT, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_payment_event(UUID, UUID, UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_users_by_email(TEXT, UUID, INTEGER) TO service_role;
