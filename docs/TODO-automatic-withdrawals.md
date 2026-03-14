# TODO: Automatic Withdrawal Processing via Keepz

## Context

As of 2026-03-14, the admin dashboard tabs for manual enrollment approval, withdrawal processing, and project subscription management have been removed. Enrollments and project subscriptions are now fully automated via the `complete_keepz_payment` RPC (migrations 111-129), which auto-approves upon successful Keepz payment callback.

**Withdrawals are NOT yet automated.** There is currently no way for users to withdraw their referral balance. This document tracks what needs to be built.

## Current State

- Users can accumulate referral balance (stored in `profiles.balance`)
- The withdrawal request flow (`withdrawal_requests` table) exists in the database
- The `useWithdrawalRequests` hook exists on the frontend
- The admin withdrawal management UI has been removed
- **No Keepz payout/transfer API integration exists**

## What Needs to Be Built

### 1. Research Keepz Payout API

- Check if Keepz supports merchant-initiated payouts/transfers
- If yes: get API docs, endpoints, required parameters
- If no: find alternative payout method (bank transfer API, BOG/TBC business API, or manual process with notification)

### 2. Backend: Payout Processing

- Create `lib/keepz-payout.ts` — Keepz payout API client (or alternative provider)
- Create `app/api/payments/keepz/process-withdrawal/route.ts`:
  - Accept withdrawal request ID
  - Validate the user's balance >= withdrawal amount
  - Call Keepz payout API to transfer funds
  - On success: update `withdrawal_requests.status = 'completed'`, deduct from `profiles.balance`
  - On failure: update status to `'failed'` with error details
- Add callback endpoint for payout status updates (if Keepz supports async payouts)

### 3. Database

- Add `keepz_payout_id` column to `withdrawal_requests` (to track the Keepz transaction)
- Add `payout_callback_payload` JSONB column for audit trail
- Consider minimum withdrawal amount and daily limits

### 4. Frontend

- Update `useWithdrawalRequests` hook to show payout status
- Add withdrawal UI in the student's balance/profile page
- Show payout processing status (pending → processing → completed/failed)

### 5. Security

- Rate limit withdrawal requests (already exists in API)
- Validate minimum withdrawal amount
- Verify user identity before large payouts
- Add admin notification for large withdrawals (> ₾100?)

## Temporary Workaround

Until automatic withdrawals are implemented, withdrawals can be processed manually:

1. Query `withdrawal_requests` table for pending requests via Supabase Dashboard
2. Process the payout manually (bank transfer)
3. Update the request status: `UPDATE withdrawal_requests SET status = 'completed' WHERE id = '...'`
4. Deduct from user balance: `UPDATE profiles SET balance = balance - <amount> WHERE id = '...'`
