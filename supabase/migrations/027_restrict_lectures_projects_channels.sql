-- Migration: Restrict Lectures and Projects channels to lecturers only
-- Description: Only course lecturers can send messages and upload videos in "Lectures" and "Projects" channels

-- Drop existing message insert policies
DROP POLICY IF EXISTS "Enrolled users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Lecturers can insert messages for their courses" ON public.messages;

-- IMPORTANT: Create lecturer policy FIRST so it takes precedence
-- Lecturers can insert messages in ALL channels of their courses (including Lectures and Projects)
CREATE POLICY "Lecturers can insert messages for their courses"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = messages.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

-- Create new policy: Enrolled users can insert messages EXCEPT in Lectures and Projects channels
-- This policy only applies if the user is NOT the lecturer
CREATE POLICY "Enrolled users can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = messages.course_id
      AND enrollments.user_id = auth.uid()
    ) AND
    -- Exclude if user is the lecturer (lecturer policy handles that)
    NOT EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = messages.course_id
      AND courses.lecturer_id = auth.uid()
    ) AND
    -- Exclude Lectures and Projects channels
    NOT EXISTS (
      SELECT 1 FROM public.channels
      WHERE channels.id = messages.channel_id
      AND (
        (LOWER(channels.name) = 'lectures' AND channels.type = 'lectures')
        OR LOWER(channels.name) = 'projects'
      )
    )
  );

-- Update videos policy to ensure it's channel-specific
-- The existing policy already restricts to lecturers, but let's make it explicit
-- that it only applies to Lectures channels (where videos are uploaded)
DROP POLICY IF EXISTS "Lecturers can manage videos for their courses" ON public.videos;

CREATE POLICY "Lecturers can manage videos for their courses"
  ON public.videos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      INNER JOIN public.channels ON channels.course_id = courses.id
      WHERE courses.id = videos.course_id
      AND channels.id = videos.channel_id
      AND courses.lecturer_id = auth.uid()
      -- Only allow in Lectures channels (videos are only uploaded to Lectures channels)
      AND (LOWER(channels.name) = 'lectures' AND channels.type = 'lectures')
    )
  );

