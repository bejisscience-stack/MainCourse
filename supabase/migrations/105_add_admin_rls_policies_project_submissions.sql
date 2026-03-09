-- Add admin SELECT policy on project_submissions
-- Without this, admins see 0 rows because RLS blocks access when service role key isn't set
CREATE POLICY "Admins can view all submissions" ON project_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Add admin UPDATE policy on project_submissions
-- Needed so the scraper edge function can update latest_views and last_scraped_at
CREATE POLICY "Admins can update all submissions" ON project_submissions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
