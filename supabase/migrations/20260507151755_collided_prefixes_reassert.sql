-- A-17: forward-only re-assertion of security-critical end states from the
-- 11 same-prefix migration collisions. Per-pair inspection confirms no two
-- collided files write the same DB object, so the end state is order-
-- independent in practice — but `supabase db reset` orders by filesystem
-- sort, which is locale-dependent. This migration locks the canonical end
-- state for the security-critical objects so that, regardless of which
-- file in each collided pair applied first, the final state matches prod.
--
-- Idempotent: each block is CREATE OR REPLACE / DROP IF EXISTS / ALTER.
-- Historical files are NOT renamed (forbidden by docs/supabase-guide.md).
--
-- Catalogued pairs (security-critical only re-asserted here):
--   233_decrypt_pii_fail_closed   ↔ 233_restore_search_path_pg_temp
--   234_chat_media_bucket_size_cap ↔ 234_extend_search_path_pg_temp
--   237_coming_soon_emails_no_anon_insert ↔ 237_profiles_drop_broad_read_policies
--
-- The 103/104/105/131/140/168/183/224 collisions touch disjoint objects
-- (channels publication vs storage bucket, function drop vs lecturer system,
-- etc.) and are catalogued in docs/supabase-guide.md without re-assertion.

-- ---------- 233_decrypt_pii_fail_closed: re-assert fail-closed body ----------
CREATE OR REPLACE FUNCTION public.decrypt_pii(p_encrypted TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key TEXT;
  v_result TEXT;
BEGIN
  IF p_encrypted IS NULL OR p_encrypted = '' THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'pii_encryption_key' LIMIT 1;
  IF v_key IS NULL OR v_key = '' THEN
    RAISE WARNING 'decrypt_pii: pii_encryption_key not found in vault';
    RETURN NULL;
  END IF;

  BEGIN
    v_result := pgp_sym_decrypt(decode(p_encrypted, 'base64'), v_key);
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'decrypt_pii: decryption failed: %', SQLERRM;
    RETURN NULL;
  END;
END;
$$;

-- ---------- 233_restore_search_path_pg_temp + 234_extend_search_path_pg_temp ----------
-- Re-assert search_path on the security-sensitive functions touched by both
-- 233_restore_search_path_pg_temp and 234_extend_search_path_pg_temp.
ALTER FUNCTION public.decrypt_pii(text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.encrypt_pii(text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.create_withdrawal_request(numeric, text)
  SET search_path = public, pg_temp;

-- ---------- 237_coming_soon_emails_no_anon_insert ----------
DROP POLICY IF EXISTS "Allow anonymous insert" ON public.coming_soon_emails;

-- ---------- 237_profiles_drop_broad_read_policies ----------
DROP POLICY IF EXISTS "Users can view profiles in same courses" ON public.profiles;
DROP POLICY IF EXISTS "Users can view co-enrolled profiles"     ON public.profiles;
DROP POLICY IF EXISTS "Lecturers can view student profiles"     ON public.profiles;
