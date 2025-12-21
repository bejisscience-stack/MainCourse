-- Migration: Add payment screenshots column to enrollment_requests
-- Description: Stores payment screenshot URLs for admin review

-- Add payment_screenshots column (JSONB array to store multiple screenshot URLs)
ALTER TABLE public.enrollment_requests
ADD COLUMN IF NOT EXISTS payment_screenshots JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.enrollment_requests.payment_screenshots IS 'Array of payment screenshot URLs uploaded by the user';







