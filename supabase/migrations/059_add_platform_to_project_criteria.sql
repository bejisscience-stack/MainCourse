-- Migration: Add platform column to project_criteria
-- Description: Allows criteria to be platform-specific

-- Add platform column (nullable for backward compatibility, but should be set for new criteria)
ALTER TABLE public.project_criteria
ADD COLUMN IF NOT EXISTS platform TEXT;

-- Add comment
COMMENT ON COLUMN public.project_criteria.platform IS 'Platform name (youtube, instagram, facebook, tiktok, etc.). NULL means criteria applies to all platforms.';

-- Create index for platform lookups
CREATE INDEX IF NOT EXISTS project_criteria_platform_idx ON public.project_criteria(project_id, platform);

-- Update existing criteria to have NULL platform (applies to all platforms)
-- This maintains backward compatibility

