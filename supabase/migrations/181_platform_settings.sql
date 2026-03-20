-- Platform settings: single-row table for admin-configurable values
-- Replaces hardcoded min withdrawal (50 GEL) and subscription price (10 GEL)

CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_withdrawal_gel numeric(10,2) NOT NULL DEFAULT 50 CHECK (min_withdrawal_gel > 0),
  subscription_price_gel numeric(10,2) NOT NULL DEFAULT 10 CHECK (subscription_price_gel > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES profiles(id)
);

-- Ensure only one row ever exists
CREATE UNIQUE INDEX platform_settings_singleton ON platform_settings ((true));

-- Seed with current production values
INSERT INTO platform_settings (min_withdrawal_gel, subscription_price_gel)
VALUES (50, 10)
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read settings (needed by client hooks and API routes)
CREATE POLICY "Authenticated users can read platform settings"
  ON platform_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can update
CREATE POLICY "Admins can update platform settings"
  ON platform_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
