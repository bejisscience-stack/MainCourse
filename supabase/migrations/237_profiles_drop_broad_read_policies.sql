-- Drops the cross-user broad SELECT policies on public.profiles.
-- Cross-user "safe read" use cases continue to flow through the
-- SECURITY DEFINER RPC public.get_safe_profiles(uuid[]) (mig 134),
-- which exposes only id/username/avatar_url/role (+email — tracked
-- as a follow-up; not addressed here).
-- Self-row reads (mig 002) and admin reads (mig 032 / mig 194) are kept.
-- Privileged-column UPDATE protection (mig 218 trigger) is unaffected.

DROP POLICY IF EXISTS "Users can view profiles in same courses" ON public.profiles;  -- mig 018, restored in 049
DROP POLICY IF EXISTS "Users can view co-enrolled profiles"     ON public.profiles;  -- mig 131
DROP POLICY IF EXISTS "Lecturers can view student profiles"     ON public.profiles;  -- mig 131
