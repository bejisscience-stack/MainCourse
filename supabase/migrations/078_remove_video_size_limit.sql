-- Migration: Remove video upload size limit
-- Description: Updates storage bucket limits to allow larger video files (up to 10GB)
-- This effectively removes the practical size limit for video uploads

-- Update chat-media bucket to allow much larger files (10GB)
UPDATE storage.buckets
SET file_size_limit = 10737418240  -- 10GB in bytes
WHERE id = 'chat-media';

-- Update course-videos bucket if it exists
UPDATE storage.buckets
SET file_size_limit = 10737418240  -- 10GB in bytes
WHERE id = 'course-videos';

-- Update course-thumbnails bucket (keep reasonable limit for images)
-- Note: Keeping this at 50MB as thumbnails don't need to be huge
UPDATE storage.buckets
SET file_size_limit = 52428800  -- 50MB in bytes
WHERE id = 'course-thumbnails';
