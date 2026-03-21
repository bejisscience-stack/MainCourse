# Agent 1 — Critical SQL: SET search_path + auth guards

**Priority:** CRITICAL + HIGH
**Findings:** CRIT-01, CRIT-03, CRIT-04, HIGH-01, HIGH-02

## Files to CREATE

- `supabase/migrations/182_set_search_path_and_auth_guards.sql`

## Files you MUST NOT touch

Everything else. No TypeScript, no edge functions, no components.

## Task

Create a single migration that applies these fixes to ALL SECURITY DEFINER functions:

### 1. Add `SET search_path = public, pg_temp` to ALL SECURITY DEFINER functions

Every SECURITY DEFINER function must be re-created with `SET search_path = public, pg_temp`. Here is the complete list (from Section 6 of the audit):

- `check_is_admin(UUID)`
- `has_project_access(UUID)`
- `approve_enrollment_request(UUID)`
- `reject_enrollment_request(UUID)`
- `approve_withdrawal_request(UUID, TEXT)`
- `reject_withdrawal_request(UUID, TEXT)`
- `approve_lecturer_account(UUID)`
- `reject_lecturer_account(UUID, TEXT)`
- `create_withdrawal_request(DECIMAL, TEXT)`
- `credit_user_balance(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT)`
- `debit_user_balance(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT)`
- `get_user_balance_info(UUID)`
- `complete_keepz_payment(UUID, JSONB)`
- `process_referral(TEXT, UUID, UUID, UUID)`
- `process_signup_referral_on_enrollment(UUID, UUID, UUID)`
- `create_referral_safe(TEXT, UUID, UUID, UUID)`
- `get_enrollment_requests_admin(TEXT)`
- `get_bundle_enrollment_requests_admin(TEXT)`
- `get_enrollment_requests_count()`
- `get_pending_lecturers()`
- `get_withdrawal_requests_admin(TEXT)`
- `get_safe_profiles(UUID[])`
- `update_own_profile(TEXT, TEXT)`
- `mark_all_notifications_read(UUID)`
- `get_unread_notification_count(UUID)`
- `approve_bundle_enrollment_request(UUID)`
- `approve_bundle_enrollment_request(UUID, UUID)`
- `reject_bundle_enrollment_request(UUID, UUID)`
- `approve_project_subscription(UUID)`
- `reject_project_subscription(UUID)`
- `get_view_scraper_schedule()`
- `update_view_scraper_schedule(TEXT, BOOLEAN)`
- `insert_audit_log(UUID, TEXT, TEXT, TEXT, JSONB, TEXT)`
- `log_payment_event(UUID, UUID, UUID, TEXT, JSONB)`
- `search_users_by_email(TEXT, UUID, INTEGER)`
- `get_profiles_for_friends(UUID[])`
- `pay_submission(UUID, NUMERIC, UUID, UUID)`
- `handle_new_user()` (trigger)
- `auto_encrypt_pii()` (trigger)
- `encrypt_withdrawal_bank_account()` (trigger)

**IMPORTANT:** You MUST read each function's current source from the latest migration that defines it. Do NOT guess the function body — read it from the codebase. Use `CREATE OR REPLACE FUNCTION` so existing logic is preserved exactly. Only add the `SET search_path = public, pg_temp` clause.

For functions with complex bodies (especially `complete_keepz_payment` in migration 168, `handle_new_user` in migration 172, and `credit_user_balance`/`debit_user_balance` in migration 073), read the FULL function body from the migration file and re-create it identically with only the `SET search_path` addition.

### 2. Add auth.uid() check to `get_user_balance_info` (CRIT-01)

Add at the top of the function body:

```sql
IF p_user_id != auth.uid() THEN
  RAISE EXCEPTION 'Access denied: cannot view another user balance info';
END IF;
```

### 3. Add auth.uid() check to `process_referral` (HIGH-02)

Add at the top of the function body:

```sql
IF p_referred_user_id != auth.uid() THEN
  RAISE EXCEPTION 'Access denied: referred user must be the caller';
END IF;
```

### Approach

Since there are 38+ functions, use `ALTER FUNCTION ... SET search_path = public, pg_temp;` where possible instead of full `CREATE OR REPLACE`. This is cleaner and safer:

```sql
-- Example:
ALTER FUNCTION public.check_is_admin(UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.has_project_access(UUID) SET search_path = public, pg_temp;
-- ... etc for all functions
```

For the two functions that need body changes (CRIT-01, HIGH-02), use `CREATE OR REPLACE` with the full body copied from the latest migration that defines them, adding only the `SET search_path` clause and the `auth.uid()` guard.

### Structure

```sql
-- Migration 182: Set search_path on all SECURITY DEFINER functions + add auth guards
-- Fixes: CRIT-01, CRIT-03, CRIT-04, HIGH-01, HIGH-02
-- Date: 2026-03-21

BEGIN;

-- Part 1: ALTER all SECURITY DEFINER functions to SET search_path
ALTER FUNCTION public.check_is_admin(UUID) SET search_path = public, pg_temp;
-- ... (all functions)

-- Part 2: Recreate get_user_balance_info with auth.uid() guard (CRIT-01)
CREATE OR REPLACE FUNCTION public.get_user_balance_info(p_user_id UUID)
-- ... (copy full body, add IF check at top)

-- Part 3: Recreate process_referral with auth.uid() guard (HIGH-02)
CREATE OR REPLACE FUNCTION public.process_referral(...)
-- ... (copy full body, add IF check at top)

COMMIT;
```

## Verification

Run `npm run build` to ensure no TypeScript compilation errors (this migration doesn't affect TS).

## Commit

```
fix: add SET search_path to all SECURITY DEFINER functions + auth guards

CRIT-01: get_user_balance_info now requires auth.uid() match
HIGH-02: process_referral now requires auth.uid() match
HIGH-01: All 38+ SECURITY DEFINER functions now have SET search_path
```

Output DONE when build passes.
