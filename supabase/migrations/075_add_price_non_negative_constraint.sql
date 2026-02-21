-- Migration: Add non-negative price constraint to courses table
-- Description: Prevents negative prices in courses table and fixes existing invalid data

-- First, fix any existing courses with negative prices by setting them to 0
UPDATE public.courses
SET price = 0
WHERE price < 0;

-- Also fix any negative original_price values
UPDATE public.courses
SET original_price = 0
WHERE original_price IS NOT NULL AND original_price < 0;

-- Add CHECK constraint for price to ensure it's always >= 0
ALTER TABLE public.courses
ADD CONSTRAINT courses_price_non_negative
CHECK (price >= 0);

-- Add CHECK constraint for original_price to ensure it's always >= 0 when not null
ALTER TABLE public.courses
ADD CONSTRAINT courses_original_price_non_negative
CHECK (original_price IS NULL OR original_price >= 0);

-- Also add the same constraints to course_bundles table if it exists
DO $$
BEGIN
    -- Fix existing bundles with negative prices
    UPDATE public.course_bundles
    SET price = 0
    WHERE price < 0;

    UPDATE public.course_bundles
    SET original_price = 0
    WHERE original_price IS NOT NULL AND original_price < 0;

    -- Add constraints to course_bundles
    ALTER TABLE public.course_bundles
    ADD CONSTRAINT course_bundles_price_non_negative
    CHECK (price >= 0);

    ALTER TABLE public.course_bundles
    ADD CONSTRAINT course_bundles_original_price_non_negative
    CHECK (original_price IS NULL OR original_price >= 0);
EXCEPTION
    WHEN undefined_table THEN
        -- course_bundles table doesn't exist, skip
        NULL;
    WHEN duplicate_object THEN
        -- Constraint already exists, skip
        NULL;
END $$;
