-- Create coming_soon_emails table for pre-launch email collection
CREATE TABLE IF NOT EXISTS coming_soon_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_coming_soon_emails_email ON coming_soon_emails(email);
CREATE INDEX IF NOT EXISTS idx_coming_soon_emails_created_at ON coming_soon_emails(created_at DESC);

-- Enable RLS
ALTER TABLE coming_soon_emails ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for email collection)
CREATE POLICY "Allow anonymous insert" ON coming_soon_emails
  FOR INSERT
  WITH CHECK (true);

-- Only allow admins to view emails
CREATE POLICY "Allow admin select" ON coming_soon_emails
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
