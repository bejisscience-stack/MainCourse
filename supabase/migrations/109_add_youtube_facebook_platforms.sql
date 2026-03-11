-- Add 'youtube' and 'facebook' to the platform CHECK constraint on view_scrape_results
-- The constraint was auto-generated, so we look it up dynamically.

DO $$
DECLARE
  _constraint_name text;
BEGIN
  SELECT c.conname INTO _constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'view_scrape_results'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%platform%';

  IF _constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.view_scrape_results DROP CONSTRAINT %I', _constraint_name);
  END IF;
END
$$;

ALTER TABLE public.view_scrape_results
  ADD CONSTRAINT view_scrape_results_platform_check
  CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'facebook'));
