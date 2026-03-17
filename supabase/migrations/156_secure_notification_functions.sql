-- Migration: 156_secure_notification_functions.sql
-- SECURITY FIX: Revoke dangerous EXECUTE grants on notification helper functions
-- from authenticated users. These SECURITY DEFINER functions allow any logged-in
-- user to create fake notifications, broadcast to all users, and enumerate UUIDs.
-- All application callsites use service_role clients, so this is safe.

-- ============================================
-- Step 1: Revoke EXECUTE on admin-only functions from authenticated and anon
-- ============================================
REVOKE EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) FROM anon;

REVOKE EXECUTE ON FUNCTION public.send_bulk_notifications(UUID[], TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.send_bulk_notifications(UUID[], TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_user_ids_by_role(TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_ids_by_role(TEXT) FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_enrolled_user_ids(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_enrolled_user_ids(UUID) FROM anon;

-- ============================================
-- Step 2: Grant EXECUTE on admin-only functions to service_role only
-- ============================================
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.send_bulk_notifications(UUID[], TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_ids_by_role(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_enrolled_user_ids(UUID) TO service_role;

-- ============================================
-- Step 3: Recreate mark_all_notifications_read with auth.uid() check
-- (Still granted to authenticated — called from user-scoped edge function clients)
-- ============================================
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Users can only mark their own notifications as read
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'access_denied: can only mark your own notifications as read';
  END IF;

  UPDATE public.notifications
  SET read = true, read_at = NOW()
  WHERE user_id = p_user_id AND read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================
-- Step 4: Recreate get_unread_notification_count with auth.uid() check
-- (Still granted to authenticated — called from user-scoped edge function clients)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Users can only check their own unread count
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'access_denied: can only check your own notification count';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.notifications
  WHERE user_id = p_user_id AND read = false;

  RETURN v_count;
END;
$$;
