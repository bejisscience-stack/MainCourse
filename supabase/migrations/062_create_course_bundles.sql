-- Migration: Create course bundles system
-- Description: Allows lecturers to bundle multiple courses together and sell them at a single price

-- Step 1: Create course_bundles table
-- ============================================
CREATE TABLE IF NOT EXISTS public.course_bundles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lecturer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.course_bundles ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS course_bundles_lecturer_id_idx ON public.course_bundles(lecturer_id);
CREATE INDEX IF NOT EXISTS course_bundles_is_active_idx ON public.course_bundles(is_active);
CREATE INDEX IF NOT EXISTS course_bundles_created_at_idx ON public.course_bundles(created_at DESC);

-- Step 2: Create course_bundle_items table (many-to-many relationship)
-- ============================================
CREATE TABLE IF NOT EXISTS public.course_bundle_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bundle_id UUID REFERENCES public.course_bundles(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  -- Ensure a course can only appear once in a bundle
  UNIQUE(bundle_id, course_id)
);

-- Enable Row Level Security
ALTER TABLE public.course_bundle_items ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS course_bundle_items_bundle_id_idx ON public.course_bundle_items(bundle_id);
CREATE INDEX IF NOT EXISTS course_bundle_items_course_id_idx ON public.course_bundle_items(course_id);

-- Step 3: Create bundle_enrollments table (tracks which students enrolled in bundles)
-- ============================================
CREATE TABLE IF NOT EXISTS public.bundle_enrollments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bundle_id UUID REFERENCES public.course_bundles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  -- Prevent duplicate enrollments
  UNIQUE(user_id, bundle_id)
);

-- Enable Row Level Security
ALTER TABLE public.bundle_enrollments ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS bundle_enrollments_user_id_idx ON public.bundle_enrollments(user_id);
CREATE INDEX IF NOT EXISTS bundle_enrollments_bundle_id_idx ON public.bundle_enrollments(bundle_id);

-- Step 4: Create bundle_enrollment_requests table (similar to enrollment_requests)
-- ============================================
CREATE TABLE IF NOT EXISTS public.bundle_enrollment_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bundle_id UUID REFERENCES public.course_bundles(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  payment_screenshots TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  -- Prevent duplicate pending requests
  UNIQUE(user_id, bundle_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- Enable Row Level Security
ALTER TABLE public.bundle_enrollment_requests ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS bundle_enrollment_requests_user_id_idx ON public.bundle_enrollment_requests(user_id);
CREATE INDEX IF NOT EXISTS bundle_enrollment_requests_bundle_id_idx ON public.bundle_enrollment_requests(bundle_id);
CREATE INDEX IF NOT EXISTS bundle_enrollment_requests_status_idx ON public.bundle_enrollment_requests(status);
CREATE INDEX IF NOT EXISTS bundle_enrollment_requests_created_at_idx ON public.bundle_enrollment_requests(created_at DESC);

-- Unique index to prevent duplicate pending requests
CREATE UNIQUE INDEX IF NOT EXISTS bundle_enrollment_requests_user_bundle_pending_idx 
ON public.bundle_enrollment_requests(user_id, bundle_id) 
WHERE status = 'pending';

-- Step 5: RLS Policies for course_bundles
-- ============================================
-- Anyone can view active bundles
DROP POLICY IF EXISTS "Anyone can view active bundles" ON public.course_bundles;
CREATE POLICY "Anyone can view active bundles"
  ON public.course_bundles FOR SELECT
  USING (is_active = true OR lecturer_id = auth.uid());

-- Lecturers can view their own bundles (active or inactive)
DROP POLICY IF EXISTS "Lecturers can view own bundles" ON public.course_bundles;
CREATE POLICY "Lecturers can view own bundles"
  ON public.course_bundles FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'lecturer'
    ) AND
    lecturer_id = auth.uid()
  );

-- Lecturers can insert their own bundles
DROP POLICY IF EXISTS "Lecturers can insert own bundles" ON public.course_bundles;
CREATE POLICY "Lecturers can insert own bundles"
  ON public.course_bundles FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'lecturer'
    ) AND
    lecturer_id = auth.uid()
  );

-- Lecturers can update their own bundles
DROP POLICY IF EXISTS "Lecturers can update own bundles" ON public.course_bundles;
CREATE POLICY "Lecturers can update own bundles"
  ON public.course_bundles FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'lecturer'
    ) AND
    lecturer_id = auth.uid()
  );

-- Lecturers can delete their own bundles
DROP POLICY IF EXISTS "Lecturers can delete own bundles" ON public.course_bundles;
CREATE POLICY "Lecturers can delete own bundles"
  ON public.course_bundles FOR DELETE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'lecturer'
    ) AND
    lecturer_id = auth.uid()
  );

-- Step 6: RLS Policies for course_bundle_items
-- ============================================
-- Anyone can view bundle items for active bundles
DROP POLICY IF EXISTS "Anyone can view bundle items" ON public.course_bundle_items;
CREATE POLICY "Anyone can view bundle items"
  ON public.course_bundle_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.course_bundles
      WHERE course_bundles.id = course_bundle_items.bundle_id
      AND (course_bundles.is_active = true OR course_bundles.lecturer_id = auth.uid())
    )
  );

-- Lecturers can insert items to their own bundles
DROP POLICY IF EXISTS "Lecturers can insert bundle items" ON public.course_bundle_items;
CREATE POLICY "Lecturers can insert bundle items"
  ON public.course_bundle_items FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.course_bundles
      WHERE course_bundles.id = course_bundle_items.bundle_id
      AND course_bundles.lecturer_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'lecturer'
      )
    )
  );

-- Lecturers can delete items from their own bundles
DROP POLICY IF EXISTS "Lecturers can delete bundle items" ON public.course_bundle_items;
CREATE POLICY "Lecturers can delete bundle items"
  ON public.course_bundle_items FOR DELETE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.course_bundles
      WHERE course_bundles.id = course_bundle_items.bundle_id
      AND course_bundles.lecturer_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'lecturer'
      )
    )
  );

-- Step 7: RLS Policies for bundle_enrollments
-- ============================================
-- Users can view their own bundle enrollments
DROP POLICY IF EXISTS "Users can view own bundle enrollments" ON public.bundle_enrollments;
CREATE POLICY "Users can view own bundle enrollments"
  ON public.bundle_enrollments FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own bundle enrollments (via admin approval)
DROP POLICY IF EXISTS "Users can insert own bundle enrollments" ON public.bundle_enrollments;
CREATE POLICY "Users can insert own bundle enrollments"
  ON public.bundle_enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Step 8: RLS Policies for bundle_enrollment_requests
-- ============================================
-- Users can view their own bundle enrollment requests
DROP POLICY IF EXISTS "Users can view own bundle enrollment requests" ON public.bundle_enrollment_requests;
CREATE POLICY "Users can view own bundle enrollment requests"
  ON public.bundle_enrollment_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own bundle enrollment requests
DROP POLICY IF EXISTS "Users can insert own bundle enrollment requests" ON public.bundle_enrollment_requests;
CREATE POLICY "Users can insert own bundle enrollment requests"
  ON public.bundle_enrollment_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all bundle enrollment requests
DROP POLICY IF EXISTS "Admins can view all bundle enrollment requests" ON public.bundle_enrollment_requests;
CREATE POLICY "Admins can view all bundle enrollment requests"
  ON public.bundle_enrollment_requests FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update bundle enrollment requests (approve/reject)
DROP POLICY IF EXISTS "Admins can update bundle enrollment requests" ON public.bundle_enrollment_requests;
CREATE POLICY "Admins can update bundle enrollment requests"
  ON public.bundle_enrollment_requests FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Step 9: Add trigger to update updated_at on course_bundles
-- ============================================
DROP TRIGGER IF EXISTS on_course_bundle_updated ON public.course_bundles;
CREATE TRIGGER on_course_bundle_updated
  BEFORE UPDATE ON public.course_bundles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Step 10: Add trigger to update updated_at on bundle_enrollment_requests
-- ============================================
DROP TRIGGER IF EXISTS on_bundle_enrollment_request_updated ON public.bundle_enrollment_requests;
CREATE TRIGGER on_bundle_enrollment_request_updated
  BEFORE UPDATE ON public.bundle_enrollment_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Step 11: Create function to approve bundle enrollment request
-- ============================================
CREATE OR REPLACE FUNCTION public.approve_bundle_enrollment_request(request_id UUID)
RETURNS void AS $$
DECLARE
  request_record public.bundle_enrollment_requests%ROWTYPE;
  bundle_course RECORD;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can approve bundle enrollment requests';
  END IF;

  -- Get the bundle enrollment request
  SELECT * INTO request_record
  FROM public.bundle_enrollment_requests
  WHERE id = request_id;

  IF NOT FOUND OR request_record.status != 'pending' THEN
    RAISE EXCEPTION 'Bundle enrollment request not found or already processed';
  END IF;

  -- Update request status
  UPDATE public.bundle_enrollment_requests
  SET 
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = TIMEZONE('utc', NOW())
  WHERE id = request_id;

  -- Create bundle enrollment
  INSERT INTO public.bundle_enrollments (user_id, bundle_id)
  VALUES (request_record.user_id, request_record.bundle_id)
  ON CONFLICT (user_id, bundle_id) DO NOTHING;

  -- Create individual course enrollments for all courses in the bundle
  FOR bundle_course IN
    SELECT course_id FROM public.course_bundle_items
    WHERE bundle_id = request_record.bundle_id
  LOOP
    INSERT INTO public.enrollments (user_id, course_id)
    VALUES (request_record.user_id, bundle_course.course_id)
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.approve_bundle_enrollment_request IS 'Approves a bundle enrollment request and creates enrollments for all courses in the bundle';

-- Step 12: Create function to reject bundle enrollment request
-- ============================================
CREATE OR REPLACE FUNCTION public.reject_bundle_enrollment_request(request_id UUID)
RETURNS void AS $$
DECLARE
  request_record public.bundle_enrollment_requests%ROWTYPE;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can reject bundle enrollment requests';
  END IF;

  -- Get the bundle enrollment request
  SELECT * INTO request_record
  FROM public.bundle_enrollment_requests
  WHERE id = request_id;

  IF NOT FOUND OR request_record.status != 'pending' THEN
    RAISE EXCEPTION 'Bundle enrollment request not found or already processed';
  END IF;

  -- Update request status
  UPDATE public.bundle_enrollment_requests
  SET 
    status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = TIMEZONE('utc', NOW())
  WHERE id = request_id;

  -- Remove bundle enrollment if it exists
  DELETE FROM public.bundle_enrollments
  WHERE user_id = request_record.user_id
  AND bundle_id = request_record.bundle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.reject_bundle_enrollment_request IS 'Rejects a bundle enrollment request and removes the bundle enrollment if it exists';


