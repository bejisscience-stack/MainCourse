-- Add featured_course_id to platform_settings
-- Allows admins to set a course to promote to new students on first login
ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS featured_course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
