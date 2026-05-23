-- Allow project creators to set any non-negative minimum view count.
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_min_views_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_min_views_check CHECK (min_views >= 0);
