ALTER FUNCTION public.accept_friend_request(uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.approve_kyc_submission(uuid, text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.create_kyc_submission(text, text, text, text, text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.create_notification(uuid, text, text, text, text, text, jsonb, uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.create_withdrawal_request(numeric, text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.get_enrolled_user_ids(uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.get_kyc_submissions_admin(text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_ids_by_role(text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.is_dm_participant(uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.open_or_create_dm_conversation(uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.reject_kyc_submission(uuid, text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.reset_dm_unread_count(uuid, uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.search_friend_candidates(text, integer)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.send_bulk_notifications(uuid[], text, text, text, text, text, jsonb, uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_profile_kyc_status()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_dm_unread_counts()
  SET search_path = public, pg_temp;
