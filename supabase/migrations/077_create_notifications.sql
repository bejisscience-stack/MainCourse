-- Migration: Create notifications table
-- Description: Comprehensive notification system for user alerts and admin messages

-- Step 1: Create notifications table
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'enrollment_approved',
    'enrollment_rejected',
    'bundle_enrollment_approved',
    'bundle_enrollment_rejected',
    'withdrawal_approved',
    'withdrawal_rejected',
    'admin_message',
    'system'
  )),
  title JSONB NOT NULL DEFAULT '{"en": "", "ge": ""}'::jsonb,
  message JSONB NOT NULL DEFAULT '{"en": "", "ge": ""}'::jsonb,
  read BOOLEAN DEFAULT false NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  created_by UUID REFERENCES auth.users(id)
);

-- Step 2: Enable Row Level Security
-- ============================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Step 3: Create indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS notifications_user_id_idx
ON public.notifications(user_id);

CREATE INDEX IF NOT EXISTS notifications_read_idx
ON public.notifications(read);

CREATE INDEX IF NOT EXISTS notifications_created_at_idx
ON public.notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_read_idx
ON public.notifications(user_id, read);

CREATE INDEX IF NOT EXISTS notifications_type_idx
ON public.notifications(type);

-- Step 4: RLS Policies
-- ============================================
-- Users can view their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all notifications
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;
CREATE POLICY "Admins can view all notifications"
  ON public.notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can insert notifications for any user
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role can do anything (for system notifications)
DROP POLICY IF EXISTS "Service role full access" ON public.notifications;
CREATE POLICY "Service role full access"
  ON public.notifications FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Step 5: Trigger for updated_at
-- ============================================
DROP TRIGGER IF EXISTS on_notification_updated ON public.notifications;
CREATE TRIGGER on_notification_updated
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Step 6: Enable Realtime for notifications table
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Step 7: Create helper function to create notifications
-- ============================================
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title_en TEXT,
  p_title_ge TEXT,
  p_message_en TEXT,
  p_message_ge TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    metadata,
    created_by
  ) VALUES (
    p_user_id,
    p_type,
    jsonb_build_object('en', p_title_en, 'ge', p_title_ge),
    jsonb_build_object('en', p_message_en, 'ge', p_message_ge),
    p_metadata,
    p_created_by
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- Step 8: Create function to send bulk notifications
-- ============================================
CREATE OR REPLACE FUNCTION public.send_bulk_notifications(
  p_user_ids UUID[],
  p_type TEXT,
  p_title_en TEXT,
  p_title_ge TEXT,
  p_message_en TEXT,
  p_message_ge TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_created_by UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    metadata,
    created_by
  )
  SELECT
    unnest(p_user_ids),
    p_type,
    jsonb_build_object('en', p_title_en, 'ge', p_title_ge),
    jsonb_build_object('en', p_message_en, 'ge', p_message_ge),
    p_metadata,
    p_created_by;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Step 9: Create function to get users by role for targeted notifications
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_ids_by_role(p_role TEXT)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_ids UUID[];
BEGIN
  SELECT array_agg(id) INTO v_user_ids
  FROM public.profiles
  WHERE role = p_role;

  RETURN COALESCE(v_user_ids, ARRAY[]::UUID[]);
END;
$$;

-- Step 10: Create function to get users enrolled in a course
-- ============================================
CREATE OR REPLACE FUNCTION public.get_enrolled_user_ids(p_course_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_ids UUID[];
BEGIN
  SELECT array_agg(DISTINCT user_id) INTO v_user_ids
  FROM public.enrollments
  WHERE course_id = p_course_id;

  RETURN COALESCE(v_user_ids, ARRAY[]::UUID[]);
END;
$$;

-- Step 11: Create function to mark all notifications as read
-- ============================================
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET read = true, read_at = NOW()
  WHERE user_id = p_user_id AND read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Step 12: Create function to get unread notification count
-- ============================================
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.notifications
  WHERE user_id = p_user_id AND read = false;

  RETURN v_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_bulk_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_ids_by_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_enrolled_user_ids TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count TO authenticated;
