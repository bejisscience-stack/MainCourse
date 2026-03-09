-- Migration 108: approve_project_subscription now also updates profiles.project_access_expires_at
--
-- Root cause: approving a subscription only updated the project_subscriptions table,
-- but the client checks profiles.project_access_expires_at as the primary access gate.
-- This caused approved users to still see "Buy Subscription" until SWR cache expired.
--
-- Fix: extend profile access when approving, and backfill any already-approved subscriptions.

-- 1. Backfill: update profiles for any already-approved active subscriptions
UPDATE profiles p
SET project_access_expires_at = ps.expires_at
FROM project_subscriptions ps
WHERE ps.user_id = p.id
  AND ps.status = 'active'
  AND ps.expires_at > NOW()
  AND (p.project_access_expires_at IS NULL OR p.project_access_expires_at < ps.expires_at);

-- 2. Replace the approve_project_subscription RPC to also update profiles
CREATE OR REPLACE FUNCTION approve_project_subscription(subscription_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sub project_subscriptions%ROWTYPE;
BEGIN
  IF NOT check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE project_subscriptions
    SET status = 'active',
        starts_at = NOW(),
        expires_at = NOW() + INTERVAL '1 month',
        approved_by = auth.uid(),
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = subscription_id
    RETURNING * INTO v_sub;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  -- Update profile project access: extend from the later of current access or now
  UPDATE profiles
    SET project_access_expires_at = GREATEST(
          COALESCE(project_access_expires_at, NOW()),
          NOW()
        ) + INTERVAL '1 month'
    WHERE id = v_sub.user_id;

  PERFORM create_notification(
    v_sub.user_id,
    'subscription_approved',
    'Project Subscription Approved',
    'პროექტის გამოწერა დამტკიცდა',
    'Your project subscription is now active!',
    'თქვენი პროექტის გამოწერა ახლა აქტიურია!',
    jsonb_build_object('subscription_id', subscription_id, 'expires_at', v_sub.expires_at),
    auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'subscription', row_to_json(v_sub));
END;
$$;
