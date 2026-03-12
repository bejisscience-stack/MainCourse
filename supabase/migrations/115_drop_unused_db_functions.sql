-- Migration 115: Drop unused database functions
-- These functions were confirmed unused via full codebase audit (2026-03-12)

-- search_users(): Created in migration 095, never called via .rpc()
DROP FUNCTION IF EXISTS search_users(text);

-- cleanup_expired_typing_indicators(): No cron job or code calls it
DROP FUNCTION IF EXISTS cleanup_expired_typing_indicators();

-- reset_unread_count(): Never called from code
DROP FUNCTION IF EXISTS reset_unread_count(uuid, uuid);

-- is_admin(): Superseded by check_is_admin()
DROP FUNCTION IF EXISTS is_admin();

-- get_user_role(): Never called from code
DROP FUNCTION IF EXISTS get_user_role(uuid);
