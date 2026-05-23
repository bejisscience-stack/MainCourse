-- Harden project_resources.url to prevent XSS via javascript:/data: link hrefs
-- and to prevent storage path laundering for image/video resources.
--
-- Background: the /api/project-media/sign endpoint signs storage URLs for any
-- project_resources.url that matches the requested path. Without scheme/prefix
-- enforcement, an approved lecturer could (a) insert a 'link' resource with a
-- javascript:/data: URL → XSS on click, or (b) alias any chat-media object key
-- they know as an image/video resource → anonymous signed URL to private files.
--
-- This migration enforces at the DB layer:
--   - resource_type = 'link'        → url MUST start with http:// or https://
--   - resource_type IN (image,video) → url MUST be a relative storage path
--                                       (no '://' sequence)
--
-- Pre-flight scan (run on staging 2026-05-23): 0 rows violate the constraint.

ALTER TABLE public.project_resources
  ADD CONSTRAINT project_resources_url_scheme_check
  CHECK (
    (resource_type = 'link' AND url ~* '^https?://')
    OR (resource_type IN ('image', 'video') AND url !~ '://')
  );

COMMENT ON CONSTRAINT project_resources_url_scheme_check
  ON public.project_resources IS
  'Link URLs must be http(s); image/video URLs must be relative storage paths. Defense-in-depth alongside server-side validation in app/api/lecturer/projects/route.ts.';
