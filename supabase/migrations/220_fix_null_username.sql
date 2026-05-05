-- Migration 220: Fix null username profile updates
--
-- Background:
--   profiles.username is declared NOT NULL (migration 019), but a small number
--   of rows have ended up with NULL anyway (legacy data, edge cases bypassing
--   handle_new_user, etc.). When such a user opens /settings and tries to
--   change their name or upload an avatar, update_own_profile (mig 098) fails:
--
--     username = CASE WHEN new_username IS NOT NULL THEN new_username
--                     ELSE username END
--
--   With OLD.username = NULL and new_username = NULL (the avatar-only path
--   passes NULL for the username arg) the SET resolves to NULL, which the
--   NOT NULL constraint rejects. The whole UPDATE aborts, so nothing gets
--   saved — the user perceives this as "I cannot change my name".
--
-- This migration:
--   1. Backfills any remaining NULL usernames with auto-generated unique
--      'user_<id-prefix>' values, mirroring handle_new_user's OAuth path.
--   2. Replaces update_own_profile so that when both OLD.username and
--      new_username are NULL, it auto-generates a safe username instead of
--      attempting to preserve NULL.
--
-- Down-migration:
--   Restore the migration 098 / 183 versions of update_own_profile. Backfilled
--   usernames are kept (no automated rollback).

-- ============================================================================
-- 1. Backfill NULL usernames
-- ============================================================================
DO $$
DECLARE
  r RECORD;
  candidate TEXT;
  attempt INT;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE username IS NULL LOOP
    candidate := 'user_' || REPLACE(LEFT(r.id::TEXT, 8), '-', '');
    attempt := 0;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
      attempt := attempt + 1;
      candidate := 'user_' || REPLACE(LEFT(r.id::TEXT, 8), '-', '') || '_' || attempt::TEXT;
    END LOOP;
    UPDATE public.profiles SET username = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- ============================================================================
-- 2. Update update_own_profile to handle the "still NULL after update" case
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_own_profile(
  new_username text DEFAULT NULL,
  new_avatar_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_id uuid;
  current_username text;
  fallback_username text;
  attempt int;
  result jsonb;
BEGIN
  user_id := auth.uid();

  IF user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'PGRST301';
  END IF;

  SELECT username INTO current_username
  FROM public.profiles
  WHERE id = user_id;

  -- If the row ends up with NULL username after this update (because the
  -- caller passed NULL and the existing value is also NULL) auto-generate
  -- a unique 'user_<id-prefix>' value so the NOT NULL constraint holds.
  IF new_username IS NULL AND current_username IS NULL THEN
    fallback_username := 'user_' || REPLACE(LEFT(user_id::TEXT, 8), '-', '');
    attempt := 0;
    WHILE EXISTS (
      SELECT 1 FROM public.profiles
      WHERE username = fallback_username AND id <> user_id
    ) LOOP
      attempt := attempt + 1;
      fallback_username := 'user_' || REPLACE(LEFT(user_id::TEXT, 8), '-', '') || '_' || attempt::TEXT;
    END LOOP;
    new_username := fallback_username;
  END IF;

  UPDATE public.profiles
  SET
    username = CASE WHEN new_username IS NOT NULL THEN new_username ELSE username END,
    avatar_url = CASE
      WHEN new_avatar_url = '__REMOVE__' THEN NULL
      WHEN new_avatar_url IS NOT NULL THEN new_avatar_url
      ELSE avatar_url
    END,
    updated_at = NOW()
  WHERE id = user_id
  RETURNING jsonb_build_object(
    'id', id,
    'username', username,
    'avatar_url', avatar_url,
    'role', role
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.update_own_profile(text, text) IS
  'Migration 220: Auto-generates a unique fallback username when both OLD and incoming username are NULL, so NOT NULL never trips. Preserves migration 098/183 behavior otherwise.';
