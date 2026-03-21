# Split 2: Keepz Commission Deduction + Remove Crypto

## Goal

1. Deduct Keepz processing fees from lecturer payouts based on payment method
2. Remove crypto payment option from codebase (currently not exposed in UI but exists in code)

## Keepz Commission Rates (from official pricing)

| Method                     | Range          | Rate            |
| -------------------------- | -------------- | --------------- |
| Bank Cards                 | 0-10,000 GEL   | 2.5%            |
| Bank Cards (international) | any            | 2.5%            |
| Online Bank                | 0-10,000 GEL   | 1%              |
| Online Bank                | 10,000+ GEL    | 0.6% (max 100₾) |
| Split Payments             | 100-12,000 GEL | 3%              |

Crypto rates don't matter since we're removing crypto.

## Files to Modify

### 1. `lib/keepz.ts`

- Add a `calculateKeepzCommission(amount: number, paymentMethodType: string): number` function
  - `'card'` → `amount * 0.025`
  - `'bank'` → `amount <= 10000 ? amount * 0.01 : Math.min(amount * 0.006, 100)`
  - `'split'` → `amount * 0.03`
  - Default/unknown → `amount * 0.025` (conservative, assume card rate)
- Remove `cryptoPaymentProvider` type, references, and the `"CITYPAY"` constant
- Keep all existing functions unchanged (createKeepzOrder, decryptCallback, etc.)

### 2. `app/api/payments/keepz/create-order/route.ts`

- When creating a Keepz order, determine the payment method type based on which provider params are passed:
  - If `directLinkProvider` is set → `payment_method_type = 'card'`
  - If `openBankingLinkProvider` is set → `payment_method_type = 'bank'`
  - If `installmentPaymentProvider` is set → `payment_method_type = 'split'`
  - Default → `'card'`
- Store `payment_method_type` in the `keepz_payments` record (needs new column from migration)
- Remove any crypto-related parameter handling

### 3. `app/api/payments/keepz/callback/route.ts`

- When calling `complete_keepz_payment()` RPC, also pass the `payment_method_type` from the payment record
- The RPC will use this to calculate and deduct commission

### 4. New Migration: `supabase/migrations/142_keepz_commission_deduction.sql`

```sql
-- Add payment method type tracking
ALTER TABLE keepz_payments ADD COLUMN IF NOT EXISTS payment_method_type TEXT DEFAULT 'card';

-- Add keepz_commission column to track the fee
ALTER TABLE keepz_payments ADD COLUMN IF NOT EXISTS keepz_commission NUMERIC(10,2) DEFAULT 0;

-- Update complete_keepz_payment RPC to deduct Keepz commission from lecturer payout
-- In the lecturer balance credit section, instead of:
--   credit = course_price (or course_price - referral_commission)
-- Do:
--   keepz_fee = calculate based on payment_method_type
--   credit = course_price - keepz_fee - referral_commission
-- Store the keepz_fee in keepz_payments.keepz_commission for audit

-- IMPORTANT: Read the existing complete_keepz_payment function from migration 139 first,
-- then CREATE OR REPLACE it with the commission deduction logic added.
-- The commission calculation SQL:
--   CASE payment_method_type
--     WHEN 'card' THEN amount * 0.025
--     WHEN 'bank' THEN CASE WHEN amount <= 10000 THEN amount * 0.01 ELSE LEAST(amount * 0.006, 100) END
--     WHEN 'split' THEN amount * 0.03
--     ELSE amount * 0.025
--   END
```

### 5. `app/api/payments/keepz/status/route.ts`

- If this route also calls `complete_keepz_payment` for recovery, pass `payment_method_type`

### 6. `app/api/payments/keepz/verify-pending/route.ts`

- Same as above — if it completes payments, pass `payment_method_type`

## DO NOT Touch

- `components/chat/` files (Agent 1)
- `components/VideoPlayer.tsx` (Agent 3)
- `app/payment/success/page.tsx` or `app/payment/failed/page.tsx` (Agent 4)
- Any admin withdrawal/balance/encryption files (Agent 5)
- `components/PaymentMethodSelector.tsx` (crypto already not shown)
- `components/EnrollmentModal.tsx` (no crypto UI exists)

## Validation

1. Run `npm run build` — must pass with zero errors
2. Verify migration SQL is syntactically correct
3. Verify commission calculation matches the rate table above
4. Commit with message: "feat: deduct Keepz commission from lecturer payouts and remove crypto support"
5. Output DONE when build passes.
