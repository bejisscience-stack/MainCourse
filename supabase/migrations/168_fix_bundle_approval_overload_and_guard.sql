-- Migration 168: Fix bundle approval overload + add pending guard
--
-- BUG-03: The stale 2-param overload approve_bundle_enrollment_request(UUID, UUID)
-- from migration 080 has outdated logic (no Keepz fee, wrong access grants).
-- The route was passing { request_id, admin_user_id } which matched this overload
-- instead of the correct 1-param version from migration 166.
-- Fix: Drop the 2-param overload.
--
-- BUG-04: The 1-param approve_bundle_enrollment_request (migration 166, line 104)
-- does SELECT * INTO v_request ... WHERE id = request_id without AND status = 'pending'.
-- Two simultaneous approvals = double credit_user_balance.
-- Fix: Add AND status = 'pending' guard (matching approve_enrollment_request).

-- ============================================================================
-- 1. Drop the stale 2-param overload from migration 080
-- ============================================================================

DROP FUNCTION IF EXISTS public.approve_bundle_enrollment_request(UUID, UUID);

-- ============================================================================
-- 2. Recreate the 1-param function with pending guard
--    Source: migration 166 lines 93-141, with AND status = 'pending' added
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_bundle_enrollment_request(request_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_request bundle_enrollment_requests%ROWTYPE;
  v_bundle course_bundles%ROWTYPE;
  v_course_id UUID;
BEGIN
  IF NOT check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_request FROM bundle_enrollment_requests WHERE id = request_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or not pending'; END IF;

  SELECT * INTO v_bundle FROM course_bundles WHERE id = v_request.bundle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bundle not found'; END IF;

  -- Credit lecturer balance
  PERFORM credit_user_balance(v_bundle.lecturer_id, v_bundle.price, 'course_purchase', request_id::TEXT);

  -- Update request status
  UPDATE bundle_enrollment_requests
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW()
    WHERE id = request_id;

  -- Enroll in all courses in bundle (lifetime: no expires_at)
  FOR v_course_id IN SELECT course_id FROM bundle_courses WHERE bundle_id = v_request.bundle_id LOOP
    INSERT INTO enrollments (user_id, course_id, approved_at)
      VALUES (v_request.user_id, v_course_id, NOW())
      ON CONFLICT (user_id, course_id) DO UPDATE SET approved_at = NOW();
  END LOOP;

  -- NOTE: First-enrollment global project access grant REMOVED (mig 166).
  -- Course enrollment now grants course-specific access only, via RLS policy
  -- "Users can view projects in enrolled courses".

  -- Create notification
  PERFORM create_notification(
    v_request.user_id,
    'bundle_enrollment_approved',
    'Bundle Enrollment Approved',
    'ბანდელის ჩარიცხვა დამტკიცდა',
    'You have been enrolled in ' || v_bundle.title,
    'თქვენ ჩაირიცხეთ ' || v_bundle.title || '-ში',
    jsonb_build_object('bundle_id', v_request.bundle_id, 'request_id', request_id),
    auth.uid()
  );
END;
$$;
