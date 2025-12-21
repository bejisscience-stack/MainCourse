-- Migration: Add platform_links to project_submissions table
-- Description: Adds a JSONB column to store platform-specific video links

ALTER TABLE public.project_submissions
ADD COLUMN IF NOT EXISTS platform_links JSONB DEFAULT NULL;

-- Add a comment to explain the structure
COMMENT ON COLUMN public.project_submissions.platform_links IS 'JSONB object storing video links by platform, e.g., {"facebook": "https://...", "youtube": "https://..."}';

