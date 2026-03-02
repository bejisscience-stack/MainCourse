-- Migration 106: Fix create_notification calls in project subscription RPCs
--
-- The create_notification function signature is:
--   create_notification(p_user_id uuid, p_type text, p_title_en text, p_title_ge text,
--                       p_message_en text, p_message_ge text, p_metadata jsonb, p_created_by uuid)
-- But the RPCs were passing jsonb objects for title/message instead of separate text params.

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

  PERFORM create_notification(
    v_sub.user_id,
    'subscription_approved',
    'Project Subscription Approved',
    'პროექტის გამოწერა დამტკიცდა',
    'Your project subscription is now active!',
    'თქვენი პროექტის გამოწერა ახლა აქტიურია!',
    jsonb_build_object('subscription_id', subscription_id, 'expires_at', v_sub.expires_at)
  );

  RETURN row_to_json(v_sub)::JSONB;
END;
$$;

CREATE OR REPLACE FUNCTION reject_project_subscription(subscription_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sub project_subscriptions%ROWTYPE;
BEGIN
  IF NOT check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE project_subscriptions
    SET status = 'rejected', updated_at = NOW()
    WHERE id = subscription_id
    RETURNING * INTO v_sub;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  PERFORM create_notification(
    v_sub.user_id,
    'subscription_rejected',
    'Project Subscription Rejected',
    'პროექტის გამოწერა უარყოფილია',
    'Your subscription was not approved. Please try again with a clearer screenshot.',
    'თქვენი გამოწერა არ დამტკიცდა. სცადეთ კიდევ უფრო ნათელი სკრინშოტით.',
    jsonb_build_object('subscription_id', subscription_id)
  );
END;
$$;
