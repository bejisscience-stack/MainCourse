-- Migration 199: Remove broad public listing policies on public buckets.
-- Public bucket object URL access remains available without broad SELECT policies.

BEGIN;

DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can view thumbnails" ON storage.objects;

COMMIT;
