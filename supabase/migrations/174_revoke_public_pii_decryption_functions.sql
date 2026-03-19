-- SEC-04, SEC-05: Restrict PII decryption/encryption functions to service_role only.
-- All callsites already use createServiceRoleClient() with admin checks,
-- so no application code is affected.

-- get_decrypted_profile(UUID)
REVOKE ALL ON FUNCTION get_decrypted_profile(UUID) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION get_decrypted_profile(UUID) TO service_role;

-- get_decrypted_profiles(UUID[])
REVOKE ALL ON FUNCTION get_decrypted_profiles(UUID[]) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION get_decrypted_profiles(UUID[]) TO service_role;

-- get_decrypted_profiles_by_referral(TEXT[])
REVOKE ALL ON FUNCTION get_decrypted_profiles_by_referral(TEXT[]) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION get_decrypted_profiles_by_referral(TEXT[]) TO service_role;

-- decrypt_pii(TEXT)
REVOKE ALL ON FUNCTION decrypt_pii(TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION decrypt_pii(TEXT) TO service_role;

-- encrypt_pii(TEXT)
REVOKE ALL ON FUNCTION encrypt_pii(TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION encrypt_pii(TEXT) TO service_role;
