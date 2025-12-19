-- Migration: Create default channels trigger
-- Description: Automatically creates "Lectures" and "Projects" channels when a course is created

-- Function to create default channels for a new course
CREATE OR REPLACE FUNCTION public.create_default_channels_for_course()
RETURNS TRIGGER AS $$
BEGIN
  -- Create "Lectures" channel
  INSERT INTO public.channels (
    course_id,
    name,
    type,
    description,
    category_name,
    display_order
  ) VALUES (
    NEW.id,
    'lectures',
    'lectures',
    'Video lectures for ' || NEW.title,
    'COURSE CHANNELS',
    0
  ) ON CONFLICT (course_id, name) DO NOTHING;

  -- Create "Projects" channel
  INSERT INTO public.channels (
    course_id,
    name,
    type,
    description,
    category_name,
    display_order
  ) VALUES (
    NEW.id,
    'projects',
    'text',
    'Project submissions and discussions for ' || NEW.title,
    'COURSE CHANNELS',
    1
  ) ON CONFLICT (course_id, name) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_course_created_create_channels ON public.courses;

-- Create trigger to call the function after a course is inserted
CREATE TRIGGER on_course_created_create_channels
  AFTER INSERT ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_channels_for_course();





