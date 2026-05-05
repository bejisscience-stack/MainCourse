-- Migration 211: Restore search_path hardening on complete_keepz_payment
--
-- Migration 210 used CREATE OR REPLACE FUNCTION without SET search_path =
-- public, pg_temp inside the function definition. CREATE OR REPLACE silently
-- drops per-function settings back to the database default, which undoes the
-- hardening migration 183 applied to every SECURITY DEFINER function as a
-- defense against search_path-manipulation attacks.
--
-- This migration is the surgical fix for environments where 210 was already
-- applied (e.g. staging). The local 210 source has also been updated to bake
-- the SET into its CREATE OR REPLACE so any future fresh deploy is correct
-- on the first apply.

ALTER FUNCTION public.complete_keepz_payment(UUID, JSONB)
  SET search_path = public, pg_temp;
