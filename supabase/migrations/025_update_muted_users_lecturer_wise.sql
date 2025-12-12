-- Migration: Update muted_users to be lecturer-wise instead of channel-wise
-- Description: When a lecturer mutes a user, they should be muted across ALL channels in ALL courses owned by that lecturer

-- Add lecturer_id column
ALTER TABLE public.muted_users ADD COLUMN IF NOT EXISTS lecturer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing records to set lecturer_id from the course's lecturer
UPDATE public.muted_users mu
SET lecturer_id = c.lecturer_id
FROM public.courses c
WHERE mu.course_id = c.id AND mu.lecturer_id IS NULL;

-- Make lecturer_id NOT NULL after populating existing records
ALTER TABLE public.muted_users ALTER COLUMN lecturer_id SET NOT NULL;

-- Drop the old unique constraint (channel_id, user_id)
ALTER TABLE public.muted_users DROP CONSTRAINT IF EXISTS muted_users_channel_id_user_id_key;

-- Add new unique constraint (lecturer_id, user_id) - one mute per user per lecturer
ALTER TABLE public.muted_users ADD CONSTRAINT muted_users_lecturer_user_unique UNIQUE (lecturer_id, user_id);

-- Make channel_id and course_id nullable since we're now lecturer-based
ALTER TABLE public.muted_users ALTER COLUMN channel_id DROP NOT NULL;
ALTER TABLE public.muted_users ALTER COLUMN course_id DROP NOT NULL;

-- Create index on lecturer_id
CREATE INDEX IF NOT EXISTS muted_users_lecturer_id_idx ON public.muted_users(lecturer_id);

-- Update RLS policies for new structure
DROP POLICY IF EXISTS "Lecturers can view muted users in their courses" ON public.muted_users;
DROP POLICY IF EXISTS "Enrolled users can view muted users in their courses" ON public.muted_users;
DROP POLICY IF EXISTS "Lecturers can mute users in their courses" ON public.muted_users;
DROP POLICY IF EXISTS "Lecturers can unmute users in their courses" ON public.muted_users;

-- Lecturers can view users they've muted
CREATE POLICY "Lecturers can view their muted users"
  ON public.muted_users FOR SELECT
  USING (
    lecturer_id = auth.uid()
  );

-- Users can view if they are muted (to check their own mute status)
CREATE POLICY "Users can view their own mute status"
  ON public.muted_users FOR SELECT
  USING (
    user_id = auth.uid()
  );

-- Lecturers can mute users
CREATE POLICY "Lecturers can mute users"
  ON public.muted_users FOR INSERT
  WITH CHECK (
    lecturer_id = auth.uid() AND
    muted_by = auth.uid()
  );

-- Lecturers can unmute users they muted
CREATE POLICY "Lecturers can unmute their muted users"
  ON public.muted_users FOR DELETE
  USING (
    lecturer_id = auth.uid()
  );

