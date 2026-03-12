-- Migration: Replace MD5(RANDOM()) with crypto-random referral codes
-- Reason: MD5(RANDOM()) is not cryptographically secure. gen_random_bytes() uses OS CSPRNG.

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate a cryptographically random 8-character hex code (uppercase)
    code := UPPER(encode(gen_random_bytes(4), 'hex'));

    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = code) INTO exists_check;

    -- Exit loop if code is unique
    EXIT WHEN NOT exists_check;
  END LOOP;

  RETURN code;
END;
$$ LANGUAGE plpgsql;
