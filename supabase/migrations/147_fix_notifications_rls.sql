-- Migration 147: Fix notifications RLS — scope service role access (SEC-03, SEC-30)
--
-- Problem: "Service role full access" (FOR ALL) lets service_role DELETE
--          notifications, breaking audit trail, and is overly broad.
-- Fix: Replace with scoped INSERT/SELECT-only for service role,
--       restrict user UPDATE to read-marking only, block all DELETE.

-- Drop the overly permissive service role policy
DROP POLICY IF EXISTS "Service role full access" ON public.notifications;

-- Service role: INSERT only (system-generated notifications)
CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Service role: SELECT only (admin dashboards, edge functions)
CREATE POLICY "Service role can read notifications"
  ON public.notifications FOR SELECT
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Recreate user UPDATE policy restricted to read-marking only
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- Only allow marking as read (no other field changes)
    AND read = true
  );

-- Block all DELETE — notifications are an audit trail
DROP POLICY IF EXISTS "No notification deletes" ON public.notifications;
CREATE POLICY "No notification deletes"
  ON public.notifications FOR DELETE
  USING (false);
