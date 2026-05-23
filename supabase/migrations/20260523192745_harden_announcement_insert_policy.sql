-- Harden the announcement-channel RESTRICTIVE INSERT policy on public.messages.
--
-- Background: migration 20260523095001 introduced a RESTRICTIVE policy meant
-- to ensure only the course lecturer (or an admin) can post into announcement
-- channels. The original lecturer check joined courses on messages.course_id,
-- which is client-supplied and not constrained to match the channel's actual
-- course. Result: a lecturer of any Course A could POST with channel_id =
-- announcement_channel_of_course_B + course_id = A, and the RESTRICTIVE policy
-- would let it through because it only validated A's lecturer relationship.
--
-- Fix: the lecturer check now joins through public.channels keyed on
-- messages.channel_id, so the lecturer must own the channel's *actual* course.
-- The announcement-detection branch and the admin escape hatch are unchanged.
--
-- Note: pre-existing permissive INSERT policies (migrations 016/027/055/132)
-- still trust messages.course_id and should be tightened in a follow-up — that
-- is broader tech debt, out of scope for this security fix.

DROP POLICY IF EXISTS "Restrict announcement posting to lecturer or admin"
  ON public.messages;

CREATE POLICY "Restrict announcement posting to lecturer or admin"
  ON public.messages
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = messages.channel_id
        AND c.type = 'announcement'
    )
    OR EXISTS (
      SELECT 1
      FROM public.channels c
      JOIN public.courses co ON co.id = c.course_id
      WHERE c.id = messages.channel_id
        AND co.lecturer_id = auth.uid()
    )
    OR public.check_is_admin(auth.uid())
  );
