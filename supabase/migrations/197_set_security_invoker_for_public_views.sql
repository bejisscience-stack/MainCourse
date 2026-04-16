-- Migration 197: Remove security definer behavior from public-facing views
-- Keeps view names/columns unchanged; only execution privilege model changes.

BEGIN;

ALTER VIEW public.public_profiles
  SET (security_invoker = true);

ALTER VIEW public.active_services_view
  SET (security_invoker = true);

COMMIT;
