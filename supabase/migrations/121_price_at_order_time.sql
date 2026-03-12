-- FIX 9: Store price at order time for Keepz payments
-- Ensures we have a record of the exact price charged, independent of later price changes.

ALTER TABLE keepz_payments
  ADD COLUMN IF NOT EXISTS price_at_order_time NUMERIC;

-- Backfill existing rows
UPDATE keepz_payments
  SET price_at_order_time = amount
  WHERE price_at_order_time IS NULL;
