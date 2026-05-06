-- Migration 222: Fix infinite recursion in dm_participants RLS
--
-- Migration 219 created this policy on public.dm_participants:
--
--   CREATE POLICY "Participants can view co-participants"
--     ON public.dm_participants FOR SELECT
--     USING (
--       EXISTS (
--         SELECT 1 FROM public.dm_participants self
--         WHERE self.conversation_id = dm_participants.conversation_id
--           AND self.user_id = (SELECT auth.uid())
--       )
--     );
--
-- The USING clause selects from the same table whose policy is being evaluated.
-- That triggers infinite recursion: SQLSTATE 42P17 "infinite recursion detected
-- in policy for relation dm_participants".
--
-- The dm-media bucket policies on storage.objects reference dm_participants via
-- EXISTS subqueries. Postgres evaluates every applicable RLS policy when a
-- statement runs against storage.objects (INSERT-time WITH CHECK clauses are
-- OR-ed across all INSERT policies, regardless of bucket_id). So uploads to
-- ANY bucket — kyc-documents, course-videos signed-URL creation, etc. — fail
-- the moment Postgres evaluates the dm-media policy and reaches the dm_participants
-- subquery.
--
-- storage-api receives the 42P17 from Postgres and translates it to its generic
-- error code DatabaseInvalidObjectDefinition, which the supabase-js client
-- surfaces as "The database schema is invalid or incompatible." That is the
-- exact error users see in the KYC modal at checkout.
--
-- Fix: replace the self-referential subquery with a SECURITY DEFINER function.
-- The function runs as postgres, so its own SELECT against dm_participants does
-- not re-enter the RLS policy. Equivalent semantics (a user can read rows for a
-- conversation iff they themselves are a participant in that conversation), no
-- recursion, no cycle.

-- ============================================
-- PART 1: SECURITY DEFINER helper
-- ============================================

CREATE OR REPLACE FUNCTION public.is_dm_participant(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dm_participants
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_dm_participant(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_dm_participant(UUID) TO authenticated;

-- ============================================
-- PART 2: Replace the recursive policy
-- ============================================

DROP POLICY IF EXISTS "Participants can view co-participants" ON public.dm_participants;

CREATE POLICY "Participants can view co-participants"
  ON public.dm_participants
  FOR SELECT
  TO authenticated
  USING (public.is_dm_participant(conversation_id));

-- ============================================
-- PART 3: Reload PostgREST schema cache
-- ============================================

NOTIFY pgrst, 'reload schema';
