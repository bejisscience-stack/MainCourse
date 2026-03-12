-- FIX: Remove user UPDATE policy on keepz_payments
-- Only the complete_keepz_payment RPC (SECURITY DEFINER) should update payment records
DROP POLICY IF EXISTS "Users can update own payments" ON keepz_payments;
