-- Migration: Fix videos RLS policy for lecturers
-- Description: Simplify the policy to allow lecturers to manage videos in any channel of their courses

-- Drop existing policies
DROP POLICY IF EXISTS "Lecturers can manage videos for their courses" ON public.videos;
DROP POLICY IF EXISTS "Enrolled users can view videos" ON public.videos;

-- Lecturers can INSERT videos in their courses
CREATE POLICY "Lecturers can insert videos"
  ON public.videos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = videos.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

-- Lecturers can UPDATE their course videos
CREATE POLICY "Lecturers can update videos"
  ON public.videos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = videos.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

-- Lecturers can DELETE their course videos
CREATE POLICY "Lecturers can delete videos"
  ON public.videos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = videos.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

-- Lecturers can SELECT their own videos (needed for management)
CREATE POLICY "Lecturers can view own course videos"
  ON public.videos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = videos.course_id
      AND courses.lecturer_id = auth.uid()
    )
  );

-- Enrolled users can view published videos
CREATE POLICY "Enrolled users can view videos"
  ON public.videos FOR SELECT
  USING (
    is_published = true AND
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = videos.course_id
      AND enrollments.user_id = auth.uid()
    )
  );




