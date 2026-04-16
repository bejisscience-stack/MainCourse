-- Migration 200: Set explicit search_path on mutable functions flagged by advisors.
-- Uses public, pg_temp pattern already used in prior security migrations.

BEGIN;

ALTER FUNCTION public.accept_friend_request(uuid, uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.are_friends(uuid, uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.block_user_action(uuid, uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.can_dm_user(uuid, uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.check_username_unique()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_dm_typing()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.create_default_channels_for_course()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.get_decrypted_profile(uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.get_decrypted_profiles_by_referral(text[])
  SET search_path = public, pg_temp;
ALTER FUNCTION public.get_or_create_dm_channel(uuid, uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_updated_at()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_dm_unread(uuid, uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.is_blocked(uuid, uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.reset_dm_unread(uuid, uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.send_friend_request(uuid, uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_dm_message_unread()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.unfriend_user(uuid, uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_unread_counts()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_unread_counts_on_video()
  SET search_path = public, pg_temp;

COMMIT;
