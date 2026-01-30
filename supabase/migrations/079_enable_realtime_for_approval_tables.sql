-- Migration: Enable Realtime for approval-related tables
-- Description: Enables Supabase Realtime for enrollment_requests, withdrawal_requests,
--              bundle_enrollment_requests, and profiles tables to support instant updates

-- Enable Realtime for enrollment_requests
-- Needed for instant enrollment status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.enrollment_requests;

-- Enable Realtime for bundle_enrollment_requests
-- Needed for instant bundle enrollment status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.bundle_enrollment_requests;

-- Enable Realtime for withdrawal_requests
-- Needed for instant withdrawal status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests;

-- Enable Realtime for profiles (for balance updates)
-- Needed for instant balance change notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
