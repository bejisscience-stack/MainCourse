-- Migration 157: Restrict complete_keepz_payment to service_role only (SEC-06)
--
-- Security fix: This SECURITY DEFINER function completes payments, creates
-- enrollments, and credits balances. It must only be callable by the Keepz
-- callback API route (which uses the service_role client). Revoking access
-- from authenticated/anon prevents any user from triggering payment completion
-- directly via supabase.rpc().

REVOKE EXECUTE ON FUNCTION public.complete_keepz_payment(UUID, JSONB) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_keepz_payment(UUID, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_keepz_payment(UUID, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.complete_keepz_payment(UUID, JSONB) TO service_role;
