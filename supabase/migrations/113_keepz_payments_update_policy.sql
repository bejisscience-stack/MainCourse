-- Add UPDATE RLS policy for keepz_payments
-- Without this, the create-order route cannot update payment rows (set checkout_url, expire stale payments)
-- which causes the unique index to block retries → "button does nothing" bug

CREATE POLICY "Users can update own payments"
  ON keepz_payments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
