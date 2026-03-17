-- Migration: Lecturer Account Approval System
-- Description: Adds is_approved column to profiles, updates handle_new_user trigger,
-- and creates RPC functions for admin to approve/reject lecturer accounts.

-- 1. Add is_approved column to profiles
-- NULL = not applicable (students), FALSE = pending, TRUE = approved
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT NULL;

-- 2. Backfill existing lecturers as approved (they were already using the platform)
UPDATE public.profiles SET is_approved = true WHERE role = 'lecturer' AND is_approved IS NULL;

-- 3. Update handle_new_user trigger to set is_approved = false for new lecturers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    CASE WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'student') = 'lecturer' THEN false ELSE NULL END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: Approve lecturer account (admin only)
CREATE OR REPLACE FUNCTION public.approve_lecturer_account(p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT public.check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can approve lecturer accounts';
  END IF;

  -- Update profile: set is_approved = true (idempotent)
  UPDATE public.profiles
  SET is_approved = true, updated_at = NOW()
  WHERE id = p_user_id AND role = 'lecturer';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lecturer profile not found for user %', p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: Reject lecturer account (admin only)
CREATE OR REPLACE FUNCTION public.reject_lecturer_account(p_user_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT public.check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can reject lecturer accounts';
  END IF;

  -- Set is_approved to false (marks as rejected)
  UPDATE public.profiles
  SET is_approved = false, updated_at = NOW()
  WHERE id = p_user_id AND role = 'lecturer';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lecturer profile not found for user %', p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: Get pending lecturers for admin (VOLATILE to prevent caching)
CREATE OR REPLACE FUNCTION public.get_pending_lecturers()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  username TEXT,
  is_approved BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Verify caller is admin
  IF NOT public.check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can view pending lecturers';
  END IF;

  RETURN QUERY
  SELECT p.id, p.email, p.full_name, p.username, p.is_approved, p.created_at, p.updated_at
  FROM public.profiles p
  WHERE p.role = 'lecturer'
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE;

-- 7. RLS: Allow lecturers to read their own is_approved status
-- (existing RLS on profiles already allows users to read their own row)
-- No additional policy needed since profiles already has "Users can view own profile" SELECT policy.
