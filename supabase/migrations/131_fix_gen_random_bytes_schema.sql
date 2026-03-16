-- Migration 131: Fix gen_random_bytes schema qualification
-- Reason: generate_referral_code() is called during signup via the
-- auto_generate_referral_code_trigger on profiles. The parent trigger
-- handle_new_user() is SECURITY DEFINER, which restricts search_path
-- and hides the extensions schema where pgcrypto lives.
-- Result: "Database error saving new user" on every signup attempt.

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    code := UPPER(encode(extensions.gen_random_bytes(4), 'hex'));
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = code) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;
