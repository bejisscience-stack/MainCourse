-- Migration: Add platform column to submission_reviews
-- Description: Allows reviews to be platform-specific

-- Add platform column (nullable for backward compatibility)
ALTER TABLE public.submission_reviews
ADD COLUMN IF NOT EXISTS platform TEXT;

-- Add comment
COMMENT ON COLUMN public.submission_reviews.platform IS 'Platform name (youtube, instagram, facebook, tiktok, etc.). NULL means review applies to all platforms (legacy).';

-- Drop the unique constraint on submission_id
ALTER TABLE public.submission_reviews
DROP CONSTRAINT IF EXISTS submission_reviews_submission_id_key;

-- Drop any existing indexes that might conflict
DROP INDEX IF EXISTS submission_reviews_submission_platform_unique;
DROP INDEX IF EXISTS submission_reviews_submission_null_platform_unique;

-- Create a unique constraint on (submission_id, platform)
-- This allows multiple reviews per submission (one per platform)
-- We'll use COALESCE to handle NULL platforms by converting them to empty string for the constraint
-- But we need a proper constraint, not just an index
-- Since PostgreSQL unique constraints don't support WHERE clauses directly, we'll create a unique index
-- and then reference it, OR we can use a workaround with a computed column or function

-- For non-NULL platforms, create unique constraint
-- We'll use a function-based unique index that treats NULL as a special value
CREATE UNIQUE INDEX IF NOT EXISTS submission_reviews_submission_platform_unique 
ON public.submission_reviews(submission_id, COALESCE(platform, ''))

-- Note: This index works for both NULL and non-NULL platforms
-- NULL platforms will be treated as empty string '', so each submission can have:
-- - One review with NULL platform (stored as '')
-- - One review per non-NULL platform value

-- Create index for platform lookups
CREATE INDEX IF NOT EXISTS submission_reviews_platform_idx ON public.submission_reviews(submission_id, platform);

-- Update existing reviews to have NULL platform (applies to all platforms)
-- This maintains backward compatibility

