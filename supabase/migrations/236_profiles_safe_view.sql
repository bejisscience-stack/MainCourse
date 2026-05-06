CREATE OR REPLACE VIEW public.profiles_safe AS
SELECT id, username, avatar_url, role
FROM public.profiles;

REVOKE ALL ON public.profiles_safe FROM PUBLIC, anon;
GRANT SELECT ON public.profiles_safe TO authenticated, service_role;

-- The view inherits RLS from profiles via security_barrier semantics
-- isn't enough. Use a security-invoker view instead:
ALTER VIEW public.profiles_safe SET (security_invoker = on);
