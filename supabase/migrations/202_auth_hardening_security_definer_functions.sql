-- =============================================================================
-- Migration 202: Auth hardening for SECURITY DEFINER functions (2026-04-17)
-- =============================================================================
-- Closes audit findings C1, C2, C3, H3, H4, M1, M2.
--
-- Problem: Functions introduced in migration 196 (friend_requests_and_dms) are
-- SECURITY DEFINER (bypass RLS) and were granted EXECUTE to `anon` + `public`.
-- They trust caller-supplied UUID arguments (`sender`, `accepting_user`,
-- `uid1/uid2`, `p_user_id`) without verifying that those UUIDs match `auth.uid()`.
-- Result: any anonymous caller with the public anon key can impersonate any user
-- by passing a spoofed UUID.
--
-- Fix: (1) add `auth.uid()` guard to every mutation RPC before any side effect,
--      (2) REVOKE EXECUTE from anon/public on info-disclosure helpers,
--      (3) REVOKE EXECUTE from all roles on trigger-only functions,
--      (4) explicit re-grant to `authenticated` to disambiguate,
--      (5) COMMENT ON FUNCTION to mark the hardened baseline.
--
-- Safety for edge functions: migration 196 commented `-- anon needed for edge
-- functions (verify_jwt:false)` but this is incorrect. Edge functions call RPCs
-- with the user's JWT via `createServerSupabaseClient(accessToken)`; PostgREST
-- resolves the role to `authenticated`, not `anon`. Therefore revoking anon
-- grants does not break edge functions.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Section 1: Add auth.uid() enforcement to mutation RPCs
-- -----------------------------------------------------------------------------

-- send_friend_request: caller must own the `sender` UUID
CREATE OR REPLACE FUNCTION public.send_friend_request(sender uuid, receiver uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  existing_request record;
  new_request record;
BEGIN
  -- SEC-202: enforce caller == sender
  IF auth.uid() IS NULL OR sender != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF sender = receiver THEN
    RETURN jsonb_build_object('error', 'Cannot send friend request to yourself');
  END IF;

  IF public.is_blocked(receiver, sender) THEN
    RETURN jsonb_build_object('status', 'sent');
  END IF;

  IF public.is_blocked(sender, receiver) THEN
    RETURN jsonb_build_object('error', 'Cannot send request to this user');
  END IF;

  IF public.are_friends(sender, receiver) THEN
    RETURN jsonb_build_object('error', 'Already friends');
  END IF;

  SELECT * INTO existing_request FROM public.friend_requests
  WHERE sender_id = sender AND receiver_id = receiver AND status = 'pending';

  IF existing_request IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Request already sent');
  END IF;

  SELECT * INTO existing_request FROM public.friend_requests
  WHERE sender_id = receiver AND receiver_id = sender AND status = 'pending';

  IF existing_request IS NOT NULL THEN
    PERFORM public.accept_friend_request(existing_request.id, sender);
    RETURN jsonb_build_object('status', 'auto_accepted');
  END IF;

  INSERT INTO public.friend_requests (sender_id, receiver_id)
  VALUES (sender, receiver)
  RETURNING * INTO new_request;

  RETURN jsonb_build_object('status', 'sent', 'id', new_request.id);
END;
$$;

-- accept_friend_request: caller must own the `accepting_user` UUID
CREATE OR REPLACE FUNCTION public.accept_friend_request(request_id uuid, accepting_user uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  req record;
BEGIN
  -- SEC-202: enforce caller == accepting_user
  IF auth.uid() IS NULL OR accepting_user != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO req FROM public.friend_requests
  WHERE id = request_id AND receiver_id = accepting_user AND status = 'pending';

  IF req IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.friend_requests SET status = 'accepted', updated_at = now()
  WHERE id = request_id;

  INSERT INTO public.friendships (user_id, friend_id)
  VALUES (req.sender_id, req.receiver_id), (req.receiver_id, req.sender_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.friend_requests SET status = 'accepted', updated_at = now()
  WHERE sender_id = accepting_user AND receiver_id = req.sender_id AND status = 'pending';

  RETURN true;
END;
$$;

-- get_or_create_dm_channel: caller must be one of the two endpoints
CREATE OR REPLACE FUNCTION public.get_or_create_dm_channel(uid1 uuid, uid2 uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  sorted_user1 uuid;
  sorted_user2 uuid;
  channel_id uuid;
BEGIN
  -- SEC-202: enforce caller is one of the channel participants
  IF auth.uid() IS NULL OR (auth.uid() != uid1 AND auth.uid() != uid2) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF uid1 < uid2 THEN
    sorted_user1 := uid1;
    sorted_user2 := uid2;
  ELSE
    sorted_user1 := uid2;
    sorted_user2 := uid1;
  END IF;

  SELECT id INTO channel_id
  FROM public.dm_channels
  WHERE user1_id = sorted_user1 AND user2_id = sorted_user2;

  IF channel_id IS NULL THEN
    INSERT INTO public.dm_channels (user1_id, user2_id)
    VALUES (sorted_user1, sorted_user2)
    RETURNING id INTO channel_id;

    INSERT INTO public.dm_unread_messages (dm_channel_id, user_id, unread_count)
    VALUES (channel_id, uid1, 0), (channel_id, uid2, 0)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN channel_id;
END;
$$;

-- reset_dm_unread: caller must own p_user_id (no one can clear someone else's unread badge)
CREATE OR REPLACE FUNCTION public.reset_dm_unread(p_channel_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- SEC-202: enforce caller == p_user_id
  IF auth.uid() IS NULL OR p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.dm_unread_messages
  SET unread_count = 0, last_read_at = now()
  WHERE dm_channel_id = p_channel_id AND user_id = p_user_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Section 2: Revoke anon/public EXECUTE from info-disclosure helpers
-- (these remain callable by `authenticated` only — they return booleans over
-- relationships/access and should not be probe-able by unauthenticated clients)
-- -----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_dm_user(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_project_access(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_submit_to_project(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_dm_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_project_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_submit_to_project(uuid, uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- Section 3: Revoke EXECUTE from anon/public on state-change + trigger-only fns
-- -----------------------------------------------------------------------------

-- reset_dm_unread: only authenticated (caller has uid guard inside)
REVOKE EXECUTE ON FUNCTION public.reset_dm_unread(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_dm_unread(uuid, uuid) TO authenticated;

-- increment_dm_unread: trigger-only; called via PERFORM from trigger_dm_message_unread
-- (which runs as SECURITY DEFINER owner). No role needs direct EXECUTE.
REVOKE EXECUTE ON FUNCTION public.increment_dm_unread(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- cleanup_dm_typing: trigger-only (BEFORE INSERT on dm_typing_indicators)
REVOKE EXECUTE ON FUNCTION public.cleanup_dm_typing() FROM PUBLIC, anon, authenticated;

-- trigger_dm_message_unread: trigger-only (AFTER INSERT on dm_messages)
REVOKE EXECUTE ON FUNCTION public.trigger_dm_message_unread() FROM PUBLIC, anon, authenticated;

-- update_unread_counts_on_video: trigger-only (see migrations 182/188/190)
REVOKE EXECUTE ON FUNCTION public.update_unread_counts_on_video() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Section 4: Re-affirm trusted authenticated grants on mutation RPCs
-- -----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.send_friend_request(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_friend_request(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_or_create_dm_channel(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unfriend_user(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.block_user_action(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm_channel(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unfriend_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_user_action(uuid, uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- Section 5: Documentation comments (hardened baseline marker)
-- -----------------------------------------------------------------------------

COMMENT ON FUNCTION public.send_friend_request(uuid, uuid) IS
  'Hardened 2026-04-17 (migration 202): requires auth.uid() = sender. Revoked from anon/public.';
COMMENT ON FUNCTION public.accept_friend_request(uuid, uuid) IS
  'Hardened 2026-04-17 (migration 202): requires auth.uid() = accepting_user. Revoked from anon/public.';
COMMENT ON FUNCTION public.get_or_create_dm_channel(uuid, uuid) IS
  'Hardened 2026-04-17 (migration 202): requires auth.uid() to be one of the two endpoints.';
COMMENT ON FUNCTION public.reset_dm_unread(uuid, uuid) IS
  'Hardened 2026-04-17 (migration 202): requires auth.uid() = p_user_id.';
COMMENT ON FUNCTION public.increment_dm_unread(uuid, uuid) IS
  'Hardened 2026-04-17 (migration 202): trigger-only; EXECUTE revoked from all roles.';
COMMENT ON FUNCTION public.cleanup_dm_typing() IS
  'Hardened 2026-04-17 (migration 202): trigger-only; EXECUTE revoked from all roles.';
COMMENT ON FUNCTION public.trigger_dm_message_unread() IS
  'Hardened 2026-04-17 (migration 202): trigger-only; EXECUTE revoked from all roles.';
COMMENT ON FUNCTION public.update_unread_counts_on_video() IS
  'Hardened 2026-04-17 (migration 202): trigger-only; EXECUTE revoked from all roles.';

COMMIT;
