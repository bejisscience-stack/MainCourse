-- Migration 124: Reinstate storage file size limits (DATA-03, DATA-01)
-- These limits were removed in migration 100; reinstating them to prevent abuse
-- TODO: Consider making course-videos private with signed URLs to prevent
-- unauthorized access to paid content. See SECURITY_AUDIT.md DATA-01

UPDATE storage.buckets SET file_size_limit = 10737418240 WHERE id = 'course-videos';    -- 10 GB
UPDATE storage.buckets SET file_size_limit = 10485760    WHERE id = 'course-thumbnails'; -- 10 MB
