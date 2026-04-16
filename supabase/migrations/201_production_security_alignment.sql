-- Migration 201: Production security alignment
-- Applies hardened settings while preserving read paths used by UI.

BEGIN;

-- 1) Remove security definer behavior from public-facing views.
ALTER VIEW public.public_profiles
  SET (security_invoker = true);

ALTER VIEW public.active_services_view
  SET (security_invoker = true);

-- 2) Harden services table access by enabling RLS and restricting management to admins.
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage services" ON public.services;
CREATE POLICY "Admins can manage services"
ON public.services
FOR ALL
USING (check_is_admin(auth.uid()))
WITH CHECK (check_is_admin(auth.uid()));

-- Keep public active-read behavior unchanged.
DROP POLICY IF EXISTS "Public can view active services" ON public.services;
CREATE POLICY "Public can view active services"
ON public.services
FOR SELECT
USING (is_active = true);

-- 3) Harden coming_soon_emails insert policy (replace always-true check).
DROP POLICY IF EXISTS "Allow anonymous insert" ON public.coming_soon_emails;
CREATE POLICY "Allow anonymous insert"
ON public.coming_soon_emails
FOR INSERT
WITH CHECK (
  email IS NOT NULL
  AND email = trim(email)
  AND length(email) BETWEEN 5 AND 254
  AND position(' ' IN email) = 0
  AND position('@' IN email) > 1
  AND position('.' IN split_part(email, '@', 2)) > 1
);

-- 4) Remove broad listing policies for public buckets.
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can view thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Public can view service images" ON storage.objects;

-- 5) Set explicit search_path on mutable functions flagged in production advisors.
ALTER FUNCTION public.check_username_unique()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.prevent_reverse_friend_request()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.restrict_friend_request_update()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_friend_request_on_unfriend()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.restrict_dm_message_update()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_dm_conversation_last_message()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.get_decrypted_profiles_by_referral(text[])
  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_unread_counts_on_video()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.get_decrypted_profile(uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_updated_at()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.create_default_channels_for_course()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.create_friendship_on_accept()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_friendship_on_reject()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_unread_counts()
  SET search_path = public, pg_temp;

COMMIT;
