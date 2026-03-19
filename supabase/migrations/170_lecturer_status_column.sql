-- Migration 170: Add lecturer_status column for 3-state tracking
--
-- Previously is_approved BOOLEAN was used: false=pending, true=approved.
-- reject_lecturer_account() set is_approved=false, identical to pending,
-- so rejected lecturers kept appearing in the pending tab.
--
-- Fix: add lecturer_status TEXT ('pending','approved','rejected') for clear filtering.
-- Keep is_approved in sync for backwards compatibility.

-- 1. Add lecturer_status column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lecturer_status TEXT DEFAULT NULL;

-- 2. Backfill from is_approved
UPDATE public.profiles
SET lecturer_status = CASE
  WHEN role = 'lecturer' AND is_approved = true THEN 'approved'
  WHEN role = 'lecturer' AND is_approved = false THEN 'pending'
  ELSE NULL
END
WHERE role = 'lecturer' AND lecturer_status IS NULL;

-- 3. Update handle_new_user trigger to set lecturer_status for new lecturers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_approved, lecturer_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    CASE WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'student') = 'lecturer' THEN false ELSE NULL END,
    CASE WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'student') = 'lecturer' THEN 'pending' ELSE NULL END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update approve_lecturer_account to set lecturer_status
CREATE OR REPLACE FUNCTION public.approve_lecturer_account(p_user_id UUID)
RETURNS void AS $$
BEGIN
  IF NOT public.check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can approve lecturer accounts';
  END IF;

  UPDATE public.profiles
  SET is_approved = true, lecturer_status = 'approved', updated_at = NOW()
  WHERE id = p_user_id AND role = 'lecturer';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lecturer profile not found for user %', p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update reject_lecturer_account to set lecturer_status = 'rejected'
CREATE OR REPLACE FUNCTION public.reject_lecturer_account(p_user_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS void AS $$
BEGIN
  IF NOT public.check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can reject lecturer accounts';
  END IF;

  UPDATE public.profiles
  SET is_approved = false, lecturer_status = 'rejected', updated_at = NOW()
  WHERE id = p_user_id AND role = 'lecturer';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lecturer profile not found for user %', p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Update get_pending_lecturers to include lecturer_status
-- Must DROP first because return type changed (added lecturer_status column)
DROP FUNCTION IF EXISTS public.get_pending_lecturers();

CREATE OR REPLACE FUNCTION public.get_pending_lecturers()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  username TEXT,
  is_approved BOOLEAN,
  lecturer_status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT public.check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can view pending lecturers';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    COALESCE(public.decrypt_pii(p.encrypted_email), p.email) AS email,
    COALESCE(public.decrypt_pii(p.encrypted_full_name), p.full_name) AS full_name,
    p.username,
    p.is_approved,
    COALESCE(p.lecturer_status,
      CASE
        WHEN p.is_approved = true THEN 'approved'
        WHEN p.is_approved = false THEN 'pending'
        ELSE 'pending'
      END
    ) AS lecturer_status,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.role = 'lecturer'
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE;
