-- Migration 114: Saved cards for Keepz tokenized card payments
-- Stores card tokens received from Keepz callbacks when saveCard: true was used.
-- Card tokens can be used for subsequent payments without redirect (server-to-server).

CREATE TABLE IF NOT EXISTS saved_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_token UUID NOT NULL,
  card_mask TEXT NOT NULL,              -- e.g. "411111******1111"
  card_brand TEXT,                      -- e.g. "VISA", "MasterCard", "AMEX"
  expiration_date TEXT,                 -- e.g. "12/27" (MM/YY)
  provider TEXT,                        -- e.g. "CREDO", "BOG", "TBC"
  keepz_order_id UUID NOT NULL,         -- integratorOrderId from the saveCard payment
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_cards_user_id ON saved_cards(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_cards_token ON saved_cards(card_token);

-- RLS
ALTER TABLE saved_cards ENABLE ROW LEVEL SECURITY;

-- Users can view their own active cards
CREATE POLICY "Users can view own saved cards"
  ON saved_cards FOR SELECT
  USING (auth.uid() = user_id);

-- Service role inserts cards (from callback), but allow user insert too
CREATE POLICY "Users can insert own saved cards"
  ON saved_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can soft-delete their own cards (update is_active to false)
CREATE POLICY "Users can update own saved cards"
  ON saved_cards FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Also add a column to keepz_payments to track if saveCard was requested
ALTER TABLE keepz_payments ADD COLUMN IF NOT EXISTS save_card BOOLEAN DEFAULT false;
