-- Migration: Allow students to reply to project messages
-- Description: Adds RLS policy to allow enrolled students to insert messages when replying to projects

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Students can reply to project messages" ON public.messages;

-- Create policy to allow students to reply to project messages
-- This allows enrolled students to insert messages when replying to a project message
-- This policy is more permissive than the general "Enrolled users can insert messages" policy
-- because it specifically allows replies to projects in restricted channels
CREATE POLICY "Students can reply to project messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    -- User must match
    auth.uid() = user_id AND
    -- Must be a reply
    reply_to_id IS NOT NULL AND
    -- The message being replied to must be a project
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.message_id = messages.reply_to_id
    ) AND
    -- User must be enrolled in the course
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = messages.course_id
      AND e.user_id = auth.uid()
    ) AND
    -- User must NOT be the lecturer (lecturers use a different policy)
    NOT EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = messages.course_id
      AND c.lecturer_id = auth.uid()
    )
  );

