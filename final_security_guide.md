# Swavleba — Final Validated Security Guide

**Branch audited:** `deps/security-fixes-staging` at `HEAD = dc8c250`
**Live DB inspected (read-only):** Supabase staging `bvptqdmhuumjbyfnjxdt`
**Production (`nbecbsbuerdtakxkrduw`) NOT queried** per project instruction. Where staging schema and production schema may diverge, the finding's verification step is given so it can be confirmed against production by re-running the cited query against `nbecbsbuerdtakxkrduw`.
**Mode:** read-only validation. No source edits, no migrations, no deploys, no destructive DB action.

This document contains only issues that were verified to exist by reading the actual file or running a `SELECT` against staging. Theoretical, "could be", cosmetic, and audit-claims-without-evidence have been excluded — see Appendix at the end.

Issues are split into:

- **Section A** — validated issues that originated in `test_sec_audit.md` and/or `docs/security-audit-2026-05-07.md` (de-duplicated, severities corrected after evidence review).
- **Section B** — additional issues discovered during the independent pass.
- **Appendix** — original-audit claim IDs that did not meet the validation standard, listed neutrally (NOT described as vulnerabilities).

---

# Section A — Validated original-audit issues

---

## Issue

A-1. `welcome_discount_expires_at` is user-mutable; permanent welcome discount via direct PATCH.

## How critical is that issue

**Critical.** Any authenticated user, no special role required, can extend their welcome-discount expiry to an arbitrary future date and apply the discount to every subsequent purchase. Direct revenue loss; reproducible with one HTTP request.

## What is causing them

The RLS policy `Users can update own profile` on `public.profiles` has `qual = (auth.uid() = id)` and **`with_check = NULL`**. Column-level enforcement is delegated to the BEFORE-UPDATE trigger `protect_profiles_privileged_columns`. The live trigger body (verified) protects only six columns: `balance`, `is_approved`, `lecturer_status`, `project_access_expires_at`, `can_create_free_projects`, `profile_completed`. It does **not** check `welcome_discount_expires_at`. PostgREST also has `UPDATE` granted on the column to role `authenticated` (`information_schema.column_privileges`).

## Impact on website

Direct revenue loss. The welcome-discount logic in `app/api/payments/keepz/create-order/route.ts` reads `welcome_discount_expires_at` from `profiles` to decide whether to apply the discount on `course_enrollment` and `bundle_enrollment` payments. Any user who runs one PATCH request gets the welcome discount applied to all paid enrollments, indefinitely. Discoverable by anyone reading the codebase or by trial-and-error against the public schema.

## Super detailed description

- **Why this is real:** I ran `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='protect_profiles_privileged_columns'` against staging; the body contains six `IF NEW.<col> IS DISTINCT FROM OLD.<col> THEN RAISE EXCEPTION` clauses, none of which name `welcome_discount_expires_at`. I then ran `SELECT column_name, privilege_type, grantee FROM information_schema.column_privileges WHERE table_schema='public' AND table_name='profiles' AND column_name='welcome_discount_expires_at'` — `UPDATE` is granted to `authenticated`. The RLS policy was confirmed via `SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND cmd='UPDATE'`; the `with_check` field is `null`, so PostgREST's UPDATE path does not re-check column-scope after the row passes USING.
- **Affected files / endpoints:**
  - DB: trigger `public.protect_profiles_privileged_columns` (current body, no migration source link is reliable because of the same-prefix migration collisions).
  - Server: `app/api/payments/keepz/create-order/route.ts` (consumer of the column).
  - PostgREST: `PATCH /rest/v1/profiles?id=eq.<self>`.
- **Attack scenario:** authenticated user opens the browser console, calls `fetch(`${supaUrl}/rest/v1/profiles?id=eq.${myUserId}`, { method: 'PATCH', headers: { Authorization: 'Bearer <jwt>', apikey: '<anon>', 'Content-Type': 'application/json' }, body: JSON.stringify({ welcome_discount_expires_at: '2099-12-31T00:00:00Z' }) })`. RLS USING passes (`auth.uid() = id`); no WITH CHECK; trigger doesn't list the column → UPDATE returns 200. Next call to `/api/payments/keepz/create-order` applies the welcome discount.
- **Origin:** `docs/security-audit-2026-05-07.md` C-01 (Critical). Confirmed.

## Brief explanation of solution

Add a clause to `protect_profiles_privileged_columns` that raises `ERRCODE 42501` when `NEW.welcome_discount_expires_at IS DISTINCT FROM OLD.welcome_discount_expires_at` and the caller's role is `authenticated`/`anon`. Same shape as the six existing clauses. The discount-grant path (`handle_new_user`) and recovery flows runs as `postgres`/`service_role`, which the early-return clause already exempts. UI behavior unchanged.

Verification (run on production): `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='protect_profiles_privileged_columns' AND pronamespace='public'::regnamespace;` then grep the body for `welcome_discount_expires_at` — expect a non-zero match after the fix.

---

## Issue

A-2. Account signup → delete → signup loop refreshes the welcome discount and the 1-month free project access.

## How critical is that issue

**High.** Authenticated users can repeat the cycle every 12 hours with no rate-limit barrier; each cycle grants a new welcome-discount window AND a fresh `+1 month` `project_access_expires_at`. Materially impacts revenue and project-access economics.

## What is causing them

- `handle_new_user()` (canonical body referenced from CLAUDE.md and migration 171/172) sets `welcome_discount_expires_at = NOW() + INTERVAL '12 hours'` and `project_access_expires_at = NOW() + INTERVAL '1 month'` on every email signup, with no per-email "first signup ever" check.
- `app/api/account/delete/route.ts:132` calls `serviceSupabase.auth.admin.deleteUser(user.id)` (hard delete; auth user record is removed). Audit-tombstone is written but is not consulted by signup.
- No re-registration cooldown anywhere in the auth path.
- Same-email signup is allowed by Supabase Auth because the prior auth user was hard-deleted.

## Impact on website

- Free welcome-discount on every paid course/bundle every cycle.
- Free project access perpetuated indefinitely without payment.
- Orphan `withdrawal_requests.user_id` rows accumulate (the deletion route nulls `payment_audit_log.user_id` and `keepz_payments.user_id`, but not `withdrawal_requests.user_id` — see also A-25).

## Super detailed description

- **Why this is real:** I read `app/api/account/delete/route.ts` end-to-end; the only state preserved at deletion is the audit_log "self_account_deleted" row and nulled `user_id` on payment_audit_log + keepz_payments. There is no `deleted_emails` table; the route does not check or write any email-keyed tombstone. Supabase Auth re-accepts the same email because the auth.users row is gone. The new signup hits `handle_new_user`, which runs unconditionally — granting `welcome_discount_expires_at = NOW() + 12h` and `project_access_expires_at = NOW() + 1 month`.
- **Affected files / endpoints:**
  - `app/api/account/delete/route.ts:132` (hard delete).
  - `handle_new_user` trigger body (refer migration 171, 207).
  - `lib/auth.ts` `signUp` (no tombstone check).
- **Attack scenario:** sign up → wait 12h+ (or just complete signup again right away to refresh discount; project access refresh is the durable gain) → call `DELETE /api/account/delete` with re-auth password → sign up with the same email → repeat. Each cycle refreshes both windows.
- **Origin:** `docs/security-audit-2026-05-07.md` LC-01. Confirmed.

## Brief explanation of solution

Two complementary, behavior-preserving changes:

1. Persist a tombstone keyed by **normalised email** (lowercase, plus-stripped) on account deletion, e.g. into a new `deleted_emails` table or as a flag on `coming_soon_emails`. On `signUp`, reject — or admin-gate — re-registration with that normalised email for a cooldown window (the audit suggests 30 days; production-tune as needed).
2. In `handle_new_user`, gate the `welcome_discount_expires_at` and the `+1 month project_access_expires_at` initial grants behind that "first ever" check. Subsequent signups for the same normalised email skip the grants.

UI is untouched. The signup form, post-signup redirect, and admin queue behave the same.

---

## Issue

A-3. `get_safe_profiles(uuid[])` returns decrypted email to any authenticated caller for any UUIDs.

## How critical is that issue

**High.** Bulk PII exfiltration. UUIDs aren't enumerable from anonymous, but any user who has interacted with another user (chat message, project submission, course enrollment, DM, friend candidate, message reaction) sees their UUID and can pass it to this RPC.

## What is causing them

The function (verified body) returns `RETURNS TABLE(id uuid, username text, email text, avatar_url text, role text)` where `email = COALESCE(public.decrypt_pii(p.encrypted_email), p.email)`. It is `SECURITY DEFINER` — so it bypasses RLS — and `routine_privileges` shows `EXECUTE` granted to `authenticated` (and `service_role`). The body applies no caller scope; it returns a row for every UUID in `user_ids`. This contradicts the otherwise fail-closed PII posture established by migrations 174/175/233 (`decrypt_pii` itself is REVOKEd from anon/authenticated/service_role and only callable inside owned `SECURITY DEFINER` chains).

## Impact on website

Any authenticated user can call `POST /rest/v1/rpc/get_safe_profiles` with a body of UUIDs and receive each user's decrypted email. An attacker who has been a member of a single course or DM channel can exfiltrate every participant's email. Compliance impact (GDPR-equivalent for Georgian/EU users), reputational, and direct phishing-target list creation.

## Super detailed description

- **Why this is real:** verified by `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='get_safe_profiles'` and `SELECT routine_name, grantee, privilege_type FROM information_schema.routine_privileges WHERE routine_name='get_safe_profiles'`. The body is unchanged from the audit's transcription. Migration 237 explicitly noted this is an open follow-up.
- **Affected files / endpoints:**
  - DB function `public.get_safe_profiles(uuid[])`.
  - PostgREST: `POST /rest/v1/rpc/get_safe_profiles`.
- **Attack scenario:** logged-in user collects UUIDs from any product surface (chat messages, message reactions list, project_submissions list, friend candidates), then calls `POST /rest/v1/rpc/get_safe_profiles` with `{ "user_ids": ["<uuid1>", "<uuid2>", ...] }`. Response includes `email` for each.
- **Origin:** `test_sec_audit.md` SEC-001. Confirmed.

## Brief explanation of solution

Pick one of the three behavior-preserving options the audit already lays out:

- (a) Drop `email` from the `RETURNS TABLE` and route any need for email lookup through the existing `get_decrypted_profile`/`get_decrypted_profiles` RPCs which are `service_role`-only; or
- (b) Add a relationship predicate inside the body (caller is admin OR shares a friendship/enrollment/DM/conversation with each requested UUID); or
- (c) `REVOKE EXECUTE FROM authenticated` and expose email lookup only via server routes that already authorize.

Existing UI flows that show usernames/avatars/role for participant lists already get those columns; only `email` should be removed from the public-callable surface. No website-visible behavior changes if option (a) is taken because the API routes don't render `email` from this RPC today (they use `get_decrypted_profile`/`get_decrypted_profiles` for admin-only flows).

---

## Issue

A-4. Next.js 14.2.35 carries an active High-severity DoS CVE plus four other advisories.

## How critical is that issue

**High.** A remote, unauthenticated attacker can saturate the running pod via specially-crafted RSC requests. The platform is live in production (per `CLAUDE.md`).

## What is causing them

`package.json:38` pins `"next": "^14.2.35"`. As of the audit cutoff:

- **GHSA-h25m-26qc-wcjf** — High, CVSS 7.5 — HTTP request deserialization → DoS via insecure React Server Components. Range `>=13.0.0 <15.0.8`.
- **GHSA-q4gf-8mx6-v5v3** — High, CVSS 7.5 — DoS via Server Components.
- **GHSA-9g9p-9gw9-jx7f** — Moderate, CVSS 5.9 — Image Optimizer DoS via remotePatterns.
- **GHSA-ggv3-7p47-pfv8** — Moderate — HTTP request smuggling in rewrites.
- **GHSA-3x4c-7xq6-9pq8** — Moderate — Unbounded `next/image` disk cache growth.
- Transitive: `postcss <8.5.10` GHSA-qx2v-qp2m-jg93 (Moderate XSS via unescaped `</style>` in CSS Stringify Output) — build-time only.

## Impact on website

Availability — the App Platform pod can be exhausted (CPU / memory / disk) by a single attacker. The `postcss` issue is build-time only and doesn't affect served traffic.

## Super detailed description

- **Why this is real:** `package.json:38` confirms the version pin; advisory IDs are already public against the cited version range. Resolves with a Next.js upgrade.
- **Affected files / endpoints:** all pages handled by Next's RSC + the image optimizer route + every `rewrites` rule in production.
- **Attack scenario:** the GHSA pages have public PoCs.
- **Origin:** `test_sec_audit.md` SEC-002 and `docs/security-audit-2026-05-07.md` H-05 — same finding.

## Brief explanation of solution

Plan a Next.js 14 → 15 → 16 upgrade window with regression testing of: App Router, the per-request CSP nonce flow in `middleware.ts`, edge-function cold starts, and Image Optimizer behavior on the existing `remotePatterns`. As an interim before the major version bump, add a WAF / upstream rate-limit rule on the affected paths (RSC handler + `/_next/image`). UI unchanged.

---

## Issue

A-5. `complete_keepz_payment` flips `keepz_payments.status` to `'success'` BEFORE the enrollment/credit business logic, so a runtime error in the inner block leaves payments stuck.

## How critical is that issue

**High.** A user pays, the row is marked successful, but they have no enrollment and the lecturer has no balance credit. Reproducible on any transient DB error (FK violation, deadlock, network blip during a nested call).

## What is causing them

Verified RPC body: the function fetches the row `FOR UPDATE`, then runs an unconditional `UPDATE keepz_payments SET status='success', paid_at=NOW(), keepz_commission=..., platform_commission=... WHERE id = v_payment.id` BEFORE entering the `BEGIN ... EXCEPTION WHEN OTHERS THEN ... END` block that performs the enrollment INSERT, balance credits, and downstream UPDATEs. PL/pgSQL `EXCEPTION` opens a subtransaction; on raise, only the inner block's effects are rolled back — the prior status flip is preserved in the outer transaction.

The function does have a recovery path triggered by the next call (`IF v_payment.status = 'success' THEN ... 'rpc_already_completed' ...`) which re-attempts enrollment / balance credit, but that path is itself unguarded against second-order errors and is only triggered if a subsequent caller hits the same `keepz_order_id`.

## Impact on website

- User charged, payment row says success, but no course access and no lecturer payout.
- Manual admin intervention required (the callback handler logs `[CRITICAL] Payment recorded as success but enrollment/subscription failed` at `app/api/payments/keepz/callback/route.ts:258`, but there is no notification — the message goes only to the application log).
- Latent reconciliation backlog; no automated retry queue.

## Super detailed description

- **Why this is real:** I read the full RPC body (`SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='complete_keepz_payment'`) — confirmed the order is (1) `FOR UPDATE` fetch, (2) `UPDATE keepz_payments SET status='success'`, (3) `BEGIN ... EXCEPTION WHEN OTHERS THEN PERFORM log_payment_event(...,'rpc_business_logic_error',...); RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'payment_recorded', true); END`. PL/pgSQL semantics make this exactly as the audit described.
- **Affected files / endpoints:**
  - DB: `complete_keepz_payment(uuid, jsonb)`.
  - Server: `app/api/payments/keepz/callback/route.ts:248-295` (the consumer that detects `payment_recorded === true`).
- **Attack scenario:** not attacker-driven; it's a reliability path. Any production transient — e.g. a concurrent enrollment INSERT failing on a partial unique constraint, or a downstream RPC raising — triggers it.
- **Origin:** `docs/security-audit-2026-05-07.md` H-03. Confirmed.

## Brief explanation of solution

Two changes inside the RPC, no behavior change to the caller:

1. Move the `UPDATE keepz_payments SET status='success', ...` statement **inside** the `BEGIN ... EXCEPTION` block (immediately after the `BEGIN`, before the `IF v_payment.payment_type = ...` switch). Now an exception rolls the status flip back to `created`/`pending`, and the caller / Keepz retry resolves it cleanly.
2. Add a daily reconciliation job (or a SECURITY DEFINER admin RPC) that finds `keepz_payments` with `status='success'` lacking the matching enrollment / balance_transactions row for `course_enrollment`/`bundle_enrollment`/`project_subscription`/`project_budget` payment_types, and either re-runs the recovery branch or surfaces an admin alert.

Optionally, wire the existing `[CRITICAL]` log line at `callback/route.ts:258` to the existing notification/email pipeline so admins are alerted in real time.

---

## Issue

A-6. `approve_project_subscription` and `approve_bundle_enrollment_request` admin RPCs lack a `status='pending'` fence on the UPDATE. Re-clicking "approve" stacks additional months and (for the bundle) re-runs side effects.

## How critical is that issue

**High.** Admin/insider abuse path; also triggered by genuine double-clicks in the admin UI.

## What is causing them

- `approve_project_subscription` (verified body): `UPDATE project_subscriptions SET status='active', starts_at=NOW(), expires_at = NOW() + INTERVAL '1 month', approved_by=auth.uid(), ... WHERE id = subscription_id` — no status fence anywhere. Then `UPDATE profiles SET project_access_expires_at = GREATEST(COALESCE(project_access_expires_at, NOW()), NOW()) + INTERVAL '1 month' WHERE id = v_sub.user_id`. Each re-call adds another month to the user's `project_access_expires_at`.
- `approve_bundle_enrollment_request(request_id)` (1-arg overload, verified body): SELECTs the row without a fence, calls `credit_user_balance(...,'course_purchase', request_id)`, UPDATEs `WHERE id = request_id`, then upserts enrollments (`ON CONFLICT (user_id, course_id) DO UPDATE SET approved_at = NOW()`). No idempotency check against `balance_transactions` for the `request_id` reference, so a re-call double-credits the lecturer.
- `approve_bundle_enrollment_request(request_id, admin_user_id)` (2-arg overload): does `IF NOT FOUND OR request_record.status != 'pending' THEN RAISE` BEFORE the UPDATE — but the UPDATE is `WHERE id = request_id` only, not `AND status = 'pending'`. TOCTOU between two concurrent admin calls.

## Impact on website

- Free additional months of project access piled onto a user.
- Repeated lecturer payouts on the bundle path (1-arg overload).
- Concurrent admin clicks can both pass the SELECT-side check and double-process.

## Super detailed description

- **Why this is real:** verified RPC bodies via `pg_get_functiondef`. Confirmed no `AND status='pending'` in the UPDATE WHERE clauses for both functions; confirmed no `NOT EXISTS balance_transactions WHERE reference_id=...` idempotency check on the bundle 1-arg path. Compare to `approve_withdrawal_request`/`approve_kyc_submission` which do correctly use `FOR UPDATE` + `AND status='pending'` (audit POSITIVE-G).
- **Affected files / endpoints:**
  - DB: `approve_project_subscription(uuid)`, `approve_bundle_enrollment_request(uuid)` and `approve_bundle_enrollment_request(uuid, uuid)`.
  - Server: `app/api/admin/project-subscriptions/...`, `app/api/admin/bundle-enrollment-requests/...`.
- **Attack scenario:** rogue or compromised admin clicks "Approve" repeatedly on the same record; each click extends `project_access_expires_at` by another month or re-credits the lecturer.
- **Origin:** `docs/security-audit-2026-05-07.md` H-02. Confirmed.

## Brief explanation of solution

Inside each function:

1. `SELECT ... FOR UPDATE` (already present in `approve_project_subscription`'s `UPDATE ... RETURNING * INTO`; for `approve_bundle_enrollment_request` add an explicit `SELECT ... FOR UPDATE` before the UPDATE).
2. Add `AND status = 'pending'` to the UPDATE's WHERE clause.
3. Use `GET DIAGNOSTICS update_count = ROW_COUNT` after the UPDATE; if zero, `RAISE EXCEPTION 'Request not found or already processed'`.
4. For the 1-arg bundle overload, wrap `credit_user_balance` and the enrollment INSERT path in the same idempotency guard the Keepz recovery branch already uses (`NOT EXISTS (SELECT 1 FROM balance_transactions WHERE reference_id = request_id AND source = 'course_purchase')`).

Admin UI behavior is unchanged: the existing toast shows the "already processed" error message that the RPC raises.

---

## Issue

A-7. `approve_enrollment_request` and `reject_enrollment_request` have a TOCTOU between SELECT-with-status and UPDATE-without-status; concurrent admin processing can double-credit.

## How critical is that issue

**High.** Real concurrency hazard — concurrent admin calls or admin double-clicks both pass the SELECT and both proceed to UPDATE + side effects (credit_user_balance, enrollments INSERT).

## What is causing them

- `approve_enrollment_request(uuid)` (verified body): `SELECT * INTO v_request FROM enrollment_requests WHERE id = request_id AND status = 'pending'; IF NOT FOUND THEN RAISE; END IF;` — but the subsequent `UPDATE enrollment_requests SET status='approved', ... WHERE id = request_id` has no `AND status = 'pending'`, no `FOR UPDATE` on the SELECT. Both concurrent transactions pass the SELECT and both run UPDATE; the enrollments INSERT uses `ON CONFLICT ... DO UPDATE SET approved_at = NOW()`, but `credit_user_balance(... 'course_purchase', request_id::TEXT)` is called on both paths and `balance_transactions` is not idempotency-keyed against `request_id`, so the lecturer's balance is credited twice.
- `reject_enrollment_request(uuid)` (verified body): same pattern — SELECT fences with `AND status = 'pending'`, UPDATE does not. Concurrent reject + reject would both run; concurrent approve + reject is more interesting (one of them runs side effects after the other has set status to its target value, which the second SELECT would already observe — but the concurrent path can still both pass under proper transaction-isolation conditions before either commit).

## Impact on website

Lecturer balance double-credit on the same `enrollment_request_id`. Recoverable via admin balance adjustment, but not auto-detected.

## Super detailed description

- **Why this is real:** verified bodies via `pg_get_functiondef`. The SELECT-side fences are present; the UPDATE-side fences are absent. Compare to `approve_withdrawal_request` etc. which use both.
- **Affected files / endpoints:**
  - DB: `approve_enrollment_request(uuid)`, `reject_enrollment_request(uuid)`.
  - Server: `app/api/admin/enrollment-requests/[id]/approve` and `app/api/admin/enrollment-requests/[id]/reject` (which already do a TOCTOU pre-check of their own — see appendix).
- **Attack scenario:** two admins click "Approve" simultaneously on the same row, OR one admin double-clicks, OR a transient retry layer fires the same RPC twice.
- **Origin:** `docs/security-audit-2026-05-07.md` H-04. Confirmed.

## Brief explanation of solution

Inside each function:

1. Replace the `SELECT * INTO v_request FROM enrollment_requests WHERE id = request_id AND status = 'pending'` with `SELECT * INTO v_request FROM enrollment_requests WHERE id = request_id AND status = 'pending' FOR UPDATE`.
2. Add `AND status = 'pending'` to the `UPDATE enrollment_requests` WHERE clause; check `GET DIAGNOSTICS update_count = ROW_COUNT` and `RAISE EXCEPTION` on zero.

UI is unchanged — the admin still sees a clear "already processed" error if a race fires.

---

## Issue

A-8. Multiple privileged-write columns on `profiles` are not covered by `protect_profiles_privileged_columns` and have `UPDATE` granted to `authenticated` — users can PATCH them directly via PostgREST.

## How critical is that issue

**Medium.** Per-column impact varies. The most material are `referral_code` (vanity / brand squatting), `signup_referral_code` and `referred_for_course_id` (tampering with audit linkage), `email` / `full_name` / `bank_account_number` and the encrypted variants (self-injection of identity attributes into admin-facing views). `welcome_discount_expires_at` is the same column as A-1; it is mentioned here only for completeness.

## What is causing them

The trigger `protect_profiles_privileged_columns` body protects only `balance`, `is_approved`, `lecturer_status`, `project_access_expires_at`, `can_create_free_projects`, `profile_completed`. `information_schema.column_privileges` was queried — `UPDATE` is granted to `authenticated` for all of: `referral_code`, `signup_referral_code`, `referred_for_course_id`, `welcome_discount_expires_at`, `email`, `full_name`, `bank_account_number`, `encrypted_email`, `encrypted_full_name`, `encrypted_bank_account_number`. The RLS UPDATE policy has `with_check = NULL`. The auto-generation trigger `auto_generate_referral_code_trigger` only fires when `NEW.referral_code IS NULL`, so post-signup the user can claim a vanity code subject only to the unique index.

## Impact on website

- `referral_code` — first-mover claim of any unused 1-20-char alphanumeric string. Brand squatting (`ADMIN`, `FREE`, etc.). Doesn't directly steal commission (the commission flow is keyed off the referrer's chosen code), but undermines marketing intent.
- `signup_referral_code`, `referred_for_course_id` — mostly cosmetic because `process_referral` consults the looked-up referrer by `referral_code`, but it lets a user rewrite their own attribution after signup, which can confuse admin reports.
- `email`, `full_name`, `bank_account_number` and the `encrypted_*` variants — a user can write fake plaintext values and NULL the encrypted columns. Admin views that fall back to plaintext via `COALESCE(decrypt_pii(p.encrypted_email), p.email)` (used in `get_safe_profiles` and elsewhere) then surface user-controlled data. Self-injection into admin-facing UIs.

## Super detailed description

- **Why this is real:** `column_privileges` query for each column returned `UPDATE | authenticated`. The trigger body returned by `pg_get_functiondef('public.protect_profiles_privileged_columns')` does not name any of these columns. The RLS UPDATE policy on `profiles` returned by `pg_policies` has `with_check = null`.
- **Affected files / endpoints:**
  - DB: `public.profiles`, trigger `protect_profiles_privileged_columns`, function `auto_generate_referral_code`.
  - PostgREST: `PATCH /rest/v1/profiles?id=eq.<self>`.
  - Consumers: `get_safe_profiles`, `get_decrypted_profile`, `get_decrypted_profiles`, admin lists.
- **Attack scenario:** authenticated user issues `PATCH /rest/v1/profiles?id=eq.<self>` with `{"referral_code":"BRAND123"}`, or `{"email":"impersonated@example.com","encrypted_email":null}`, etc. RLS USING passes; no WITH CHECK; trigger doesn't list the column → 200.
- **Origin:** `test_sec_audit.md` SEC-005, `docs/security-audit-2026-05-07.md` M-12. Confirmed and extended (the encrypted-PII columns and the plaintext bank/full_name/email columns were not all enumerated in the original; the staging `column_privileges` query during this validation pass confirms each one).

## Brief explanation of solution

Extend `protect_profiles_privileged_columns` with one `IF NEW.<col> IS DISTINCT FROM OLD.<col> THEN RAISE EXCEPTION ... USING ERRCODE='42501'; END IF;` clause for each column listed above. Allowed user-mutable columns reduce to `username` and `avatar_url`. Bank account number and marketing consent already mutate via dedicated server routes / RPCs (`/api/balance` PATCH, the marketing-consent toggle inside `/api/complete-profile`); the routes use the right service-role / user-token surface and continue to work.

UI is unchanged. The form fields the user can edit don't include any of the protected columns directly — they all go through dedicated routes today.

---

## Issue

A-9. `submission_reviews` carries an "Authenticated users can view submission reviews" SELECT policy with `qual = (SELECT auth.uid()) IS NOT NULL`. Combined with the narrower-by-enrollment policy, the broad policy wins under PostgreSQL's PERMISSIVE-OR semantics — every authed user can SELECT every review.

## How critical is that issue

**Medium.** Cross-cohort grade visibility and lecturer payout transparency.

## What is causing them

Verified policy list via `SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='submission_reviews'`. Two SELECT policies coexist: the narrower "Users can view reviews in enrolled courses" (joins through `project_submissions`, `projects`, `enrollments`/`courses`) AND the broad "Authenticated users can view submission reviews" with `(SELECT auth.uid()) IS NOT NULL`. Under PostgreSQL RLS, multiple PERMISSIVE policies are OR'd; the broad policy admits every authenticated user.

## Impact on website

A signed-in student of any course can SELECT every row of `submission_reviews` across the entire platform — grades, lecturer comments, paid-out amounts (`pay_submission` writes payout fields here), the reviewing lecturer ID, and the reviewed student ID.

## Super detailed description

- **Why this is real:** confirmed via the `pg_policies` query above. The broad policy was likely a leftover from earlier development; the narrower policy is sufficient for the application's intended access pattern.
- **Affected files / endpoints:**
  - DB: `public.submission_reviews` policies.
  - PostgREST: `GET /rest/v1/submission_reviews?...`.
- **Attack scenario:** any authed user issues `GET /rest/v1/submission_reviews?select=*&limit=10000` and pages through every grade/payout in the system.
- **Origin:** `test_sec_audit.md` SEC-006. Confirmed.

## Brief explanation of solution

Drop the "Authenticated users can view submission reviews" policy. The narrower "Users can view reviews in enrolled courses" + "Lecturers can update reviews" + "Admins can update submission reviews for payout" set already covers the application's intended access. Add an explicit admin SELECT policy if missing (verify via `pg_policies` after the drop).

No UI change — the admin pages and lecturer pages already query through the narrower path; the drop just removes the unintended back door for non-enrolled users.

---

## Issue

A-10. `process_signup_referral_on_enrollment(p_user_id, p_enrollment_request_id, p_course_id)` is granted to `authenticated` and never checks `p_user_id = auth.uid()`.

## How critical is that issue

**Medium.** IDOR-style write-on-behalf-of-user. No direct theft, but lets an attacker pre-create a referral row for a victim's pending enrollment, denying the legitimate referrer their commission via the `ON CONFLICT (referred_user_id, enrollment_request_id) DO NOTHING`.

## What is causing them

Verified body via `pg_get_functiondef`. The function is `SECURITY DEFINER`, has `EXECUTE` granted to `authenticated`, and the body does not call `auth.uid()` to compare against `p_user_id`. Compare with `process_referral`, which does.

## Impact on website

Any authenticated user can call `POST /rest/v1/rpc/process_signup_referral_on_enrollment` with `{"p_user_id":"<victim>","p_enrollment_request_id":"<their pending request>","p_course_id":"<uuid>"}` and write a referral row. If the victim's `signup_referral_code` resolves to nobody, the function returns NULL and the row is not created — but if it resolves to a real referrer, the row is created. A subsequent legitimate trigger (or admin recovery) hits the unique-index `DO NOTHING` and the legitimate referrer gets nothing.

## Super detailed description

- **Why this is real:** verified body and grants.
- **Affected files / endpoints:**
  - DB: `process_signup_referral_on_enrollment(uuid, uuid, uuid)`.
  - PostgREST: `POST /rest/v1/rpc/process_signup_referral_on_enrollment`.
- **Attack scenario:** attacker discovers a victim's pending enrollment_request_id (e.g. via shared lecturer dashboard, course administration leaks, or guessing within the small-id namespace) and pre-fires the RPC.
- **Origin:** `test_sec_audit.md` SEC-004. Confirmed.

## Brief explanation of solution

Add `IF p_user_id <> auth.uid() THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;` at the top of the function body, mirroring `process_referral`. UI/calling site is unaffected — the route that triggers this RPC always passes the caller's own `auth.uid()`.

---

## Issue

A-11. `approve_bundle_enrollment_request(request_id)` 1-arg overload double-credits the lecturer when the same request was already paid via Keepz.

## How critical is that issue

**Medium.** Insider abuse path. Any admin can recover-approve a Keepz-paid bundle and the lecturer gets credited a second time for the same request.

## What is causing them

Verified RPC body. The 1-arg manual-approval overload calls `PERFORM credit_user_balance(v_bundle.lecturer_id, v_lecturer_amount, 'course_purchase', request_id::TEXT)` with no `NOT EXISTS (SELECT 1 FROM balance_transactions WHERE reference_id = request_id AND source = 'course_purchase')` guard. `complete_keepz_payment`'s recovery branch DOES use that guard — so the asymmetry means a Keepz-paid request that an admin then re-approves manually gets double-credited.

## Impact on website

One-off duplicate credit per re-approve, equal to `bundle.price - 3% commission`, paid to the lecturer. Auditable in `balance_transactions` but not auto-detected.

## Super detailed description

- **Why this is real:** confirmed by side-by-side reading of `complete_keepz_payment` body (which has the `NOT EXISTS balance_transactions` check) and `approve_bundle_enrollment_request(uuid)` body (which does not).
- **Affected files / endpoints:**
  - DB: `approve_bundle_enrollment_request(uuid)`.
  - Server: `app/api/admin/bundle-enrollment-requests/...`.
- **Origin:** `test_sec_audit.md` SEC-009. Confirmed.

## Brief explanation of solution

Wrap the `credit_user_balance` call with the same guard `complete_keepz_payment` uses:

```sql
IF NOT EXISTS (
  SELECT 1 FROM balance_transactions
  WHERE reference_id = request_id::TEXT
  AND source = 'course_purchase'
) THEN
  PERFORM credit_user_balance(...);
END IF;
```

Or, alternatively, refuse to manually approve a request whose `keepz_payments` row is already at `status='success'`. UI is unchanged.

---

## Issue

A-12. Hostname allowlist for video-platform classification uses `String.includes(allowed)` — `tiktok.com.evil.com` matches.

## How critical is that issue

**Medium.** Two real concrete impacts: (a) view-count fraud — a user submits a non-TikTok URL pretending to be TikTok and the scraper routes it through the TikTok-specific Apify actor, contaminating the payout-tied view count if Apify ever returns attacker-controlled numbers; (b) phishing — video URLs are rendered as clickable links elsewhere in the UI. No SSRF (dispatch is to Apify, not internal infra).

## What is causing them

Two locations:

- `lib/video-url-parser.ts:18-19` (`validatePlatformUrl`) and `:31-32` (`detectPlatform`): use `hostname.includes("tiktok.com")` / `hostname.includes("instagram.com")`.
- `supabase/functions/view-scraper/index.ts:14-16` (inline `detectPlatform`): same pattern.

`new URL("https://tiktok.com.evil.com/x").hostname.includes("tiktok.com")` is `true`; the safe `endsWith("." + allowed) || === allowed` would return `false`.

## Impact on website

Submission of `https://tiktok.com.evil.com/...` passes `validatePlatformUrl("tiktok", url)` and is treated as TikTok by the scraper. The scraper hands the URL to Apify's TikTok actor; the actor's output then drives `pay_submission` view-count math. Independent of payout, the URL is rendered as a clickable link in the UI elsewhere.

## Super detailed description

- **Why this is real:** read both files. `lib/video-url-parser.ts` and `supabase/functions/view-scraper/index.ts` confirmed.
- **Affected files / endpoints:**
  - `lib/video-url-parser.ts`.
  - `supabase/functions/view-scraper/index.ts`.
  - Any UI that renders submission video URLs.
- **Attack scenario:** student creates a project_submission with `video_url=https://tiktok.com.evil.com/...`. Validation passes. Scraper proxies the URL to Apify's TikTok actor. UI links to the URL.
- **Origin:** `test_sec_audit.md` SEC-003. Confirmed; severity in this guide is **Medium** (audit's own downgrade path) because external dispatch makes SSRF non-applicable.

## Brief explanation of solution

Replace `hostname.includes(allowed)` with strict suffix match:

```ts
hostname === allowed || hostname.endsWith("." + allowed);
```

in both files (`lib/video-url-parser.ts` and `supabase/functions/view-scraper/index.ts`). Then add `m.tiktok.com` / `vm.tiktok.com` / `www.tiktok.com` etc. to the allowlist if shortlinks need to keep working — those already match the safe suffix check. UI behavior unchanged for legitimate URLs.

---

## Issue

A-13. Admin notifications API trusts caller-supplied `category` to bypass `marketing_emails_consent` for `target_type='all'`.

## How critical is that issue

**Medium.** Admin trust gap (insider / compromised admin). GDPR/Georgian-equivalent compliance impact for unsolicited marketing.

## What is causing them

`app/api/admin/notifications/send/route.ts`: `category` is read from the request body (line 350-354), and `effectiveRespectConsent = !TRANSACTIONAL_CATEGORIES.has(category)` (line 355), where `TRANSACTIONAL_CATEGORIES = {transactional_security, transactional_terms, transactional_account}` (line 72-76). If the admin sets `category` to one of those, marketing-consent filtering is skipped at line 220-235. The override is logged with `override_consent: true` at line 631, but no second human gate, no per-day cap, no template-binding.

## Impact on website

A single admin (or an attacker who has compromised an admin token) can send marketing email to every user with `target_type='all'` simply by labelling the message `transactional_security`. The marketing-consent toggle in the UI is rendered moot. EU/GDPR-equivalent fine exposure.

## Super detailed description

- **Why this is real:** read the route end-to-end. Confirmed `category` from body is not bound to message content / template / pre-registered event.
- **Affected files / endpoints:**
  - `app/api/admin/notifications/send/route.ts:341-355, 540-556, 614-633`.
  - DB: `email_send_history` (records the send).
- **Attack scenario:** admin opens the notifications-send admin UI (or POSTs directly), sends a "Welcome to our new course!" message labelled `category=transactional_security`, target_type=`all`. All non-consenting users receive it.
- **Origin:** `test_sec_audit.md` SEC-010. Confirmed.

## Brief explanation of solution

Pick one of (in increasing order of strictness, behavior-preserving):

1. Add a per-day cap on bulk sends with `override_consent=true`, surfaced in the admin UI as a banner (visible to admins only, not site users).
2. Bind `transactional_*` categories to specific pre-registered template names; reject any `category=transactional_*` whose `title` or `message` doesn't match a known template.
3. Require a second admin's approval (a `pending_bulk_email` table + an "Approve send" admin action) before any `override_consent=true` bulk goes out.

(1) is the smallest behavior change. UI for legitimate transactional sends is preserved.

---

## Issue

A-14. Login flow distinguishes "unconfirmed account" vs "wrong password / unknown account" — supports account enumeration.

## How critical is that issue

**Medium.** Any anonymous attacker with a candidate email list can determine which accounts exist and are unconfirmed.

## What is causing them

`lib/auth.ts:140-152`:

```ts
if (
  error.message.includes("Email not confirmed") ||
  error.message.includes("email_not_confirmed")
) {
  throw new Error(
    "Please verify your email address before signing in. Check your inbox for the verification email.",
  );
}
if (error.message.includes("Invalid login credentials")) {
  throw new Error(
    "Invalid email or password. Please check your credentials and try again.",
  );
}
```

Three observable states emerge: account exists + confirmed → `Invalid email or password`; account exists + unconfirmed → `Please verify your email`; account does not exist → `Invalid email or password`. The "verify your email" message uniquely identifies the second state.

## Impact on website

Email-list enumeration. Useful for credential-stuffing (skip known-unconfirmed addresses, or focus phishing on confirmed-but-existing addresses).

## Super detailed description

- **Why this is real:** read `lib/auth.ts` `signIn` end-to-end.
- **Affected files / endpoints:**
  - `lib/auth.ts:140-152`.
  - The login form that surfaces the message.
- **Attack scenario:** attacker submits POST to login with target email + random password. Response message reveals state.
- **Origin:** `docs/security-audit-2026-05-07.md` M-02. Confirmed.

## Brief explanation of solution

Make the login endpoint return the same `Invalid email or password` message for both `Email not confirmed` and `Invalid login credentials`. Move the "Please verify your email" hint to the resend-confirmation flow (after the user has explicitly entered their email there) — that flow can safely confirm existence because it's the user's own intent. UI doesn't lose functionality; users who actually need the verify-email hint will get it on the resend-confirmation form.

---

## Issue

A-15. `keepz_payments.callback_payload` stores the decrypted Keepz callback (including `cardInfo` with mask, brand, expiration date, token) as plaintext jsonb at rest.

## How critical is that issue

**Medium.** Data-at-rest concern. Card mask + brand + last-4 are PCI-DSS-scope when combined with cardholder context; even though Keepz tokenizes the actual PAN, accumulating this data per-payment expands compliance scope.

## What is causing them

- `complete_keepz_payment` body: `UPDATE keepz_payments SET status='success', callback_payload = p_callback_payload, paid_at = NOW(), ... WHERE id = v_payment.id` — the entire decrypted payload is persisted.
- `app/api/payments/keepz/callback/route.ts:348-356`: the failed-payment branch also persists the full `callbackData` to `callback_payload`.
- `app/api/payments/keepz/callback/route.ts:127-138`: even decrypt-failure path writes a `{raw_encrypted: true, error: ...}` record.

The encrypted `cardInfo.token` is also persisted into `saved_cards.card_token` (separate concern, see A-16).

## Impact on website

At-rest exposure. Supabase storage encryption applies, but a service-role-key compromise yields card mask/brand/expiration/token for every successful payment in `keepz_payments.callback_payload`. PCI-DSS scope creep.

## Super detailed description

- **Why this is real:** read both the RPC body (which stores the full payload) and the callback route (which does not pre-filter the payload before writing it).
- **Affected files / endpoints:**
  - DB: `keepz_payments.callback_payload`.
  - Server: `app/api/payments/keepz/callback/route.ts`.
  - DB function `complete_keepz_payment(uuid, jsonb)`.
- **Origin:** `docs/security-audit-2026-05-07.md` M-09. Confirmed.

## Brief explanation of solution

Filter the persisted payload to a minimal set before writing — keep only what reconciliation actually needs (`status`, `keepz_order_id`, `paymentMethodType`, `amount`, `currency`, `paid_at`). Strip `cardInfo`, `cardMask`, `cardToken`, `cardBrand`, `expirationDate`, and any other card-context fields before INSERT. If correlation against the `card_token` is needed, store a hash of it instead of the value. This change is internal to the callback handler and the RPC; user-facing flows are unaffected.

---

## Issue

A-16. `saved_cards.card_token` UNIQUE index is single-column; the Keepz callback upsert uses `onConflict: "card_token"` — cross-user clobber if Keepz ever reuses the same `cardToken` value across different paying users.

## How critical is that issue

**Medium (latent).** Exploitability depends on Keepz's tokenization semantics, which I cannot verify from this side. If Keepz keys tokens on the underlying PAN (a typical scheme), two different users saving the same physical card receive the same `cardToken`, and one user's `saved_cards` row is silently overwritten with the other's `user_id`. Data-integrity and silent loss of saved-card record.

## What is causing them

- `pg_indexes` confirms: `CREATE UNIQUE INDEX idx_saved_cards_token ON public.saved_cards USING btree (card_token)` — single column, not `(user_id, card_token)`.
- `app/api/payments/keepz/callback/route.ts:322-336`: `supabase.from("saved_cards").upsert({...}, { onConflict: "card_token" })` — when a duplicate `card_token` is encountered, the existing row's `user_id` is replaced with the new caller's `user_id`.

## Impact on website

- User A saves a card; later User B (different person, same physical card — e.g. a shared family/business card) saves it on a different order. User A's `saved_cards` row is overwritten; from A's perspective the saved card "disappears".
- The downstream lookup at `app/api/payments/saved-cards/route.ts:35-41` filters by `user_id`, so cross-user _charging_ via the API is not possible. The data integrity issue is real on its own.

## Super detailed description

- **Why this is real:** index inventory + callback file confirmed. The latency depends on Keepz behavior; the audit notes it as a question to confirm with Keepz support.
- **Affected files / endpoints:**
  - DB: `public.saved_cards`, `idx_saved_cards_token`.
  - Server: `app/api/payments/keepz/callback/route.ts:322-336`.
- **Attack scenario:** organic — two users save the same physical card.
- **Origin:** `docs/security-audit-2026-05-07.md` H-01 (severity changed to Medium here because the cross-user _charge_ path is filtered by `user_id`; the integrity loss alone is Medium-tier).

## Brief explanation of solution

Two-step:

1. New migration: drop `idx_saved_cards_token` and create `CREATE UNIQUE INDEX idx_saved_cards_user_token ON public.saved_cards (user_id, card_token)`.
2. In `app/api/payments/keepz/callback/route.ts:334`, change `onConflict: "card_token"` to `onConflict: "user_id,card_token"`.

Run an audit query first: `SELECT card_token, COUNT(DISTINCT user_id) FROM saved_cards GROUP BY card_token HAVING COUNT(DISTINCT user_id) > 1` — any rows here are existing cross-user overwrites that need manual reconciliation before the migration runs.

UI is unchanged.

---

## Issue

A-17. `supabase/migrations/` contains 11 same-prefix filename collisions, including pairs of security-critical migrations whose apply order is filesystem-sort-dependent.

## How critical is that issue

**Medium.** Latent, but two of the colliding pairs carry security-relevant changes (`233_decrypt_pii_fail_closed` ↔ `233_restore_search_path_pg_temp`, `237_coming_soon_emails_no_anon_insert` ↔ `237_profiles_drop_broad_read_policies`). On a fresh `supabase db reset` or a new environment, locale-dependent filesystem sort can apply them in either order, leaving the schema in an inconsistent intermediate state.

## What is causing them

`ls supabase/migrations/ | sort` enumerates: `103_*`×2, `104_*`×2, `105_*`×2, `131_*`×2, `140_*`×2, `168_*`×2, `183_*`×2, `224_*`×2, `233_*`×2, `234_*`×2, `237_*`×2. CLAUDE.md says: "Do not hand-prefix sequential numbers — see `docs/supabase-guide.md`. Use `supabase migration new <descriptive_name>` (timestamp prefix)."

## Impact on website

Apply-order ambiguity on production cutover or new-environment setup; not exploit-driven. The risk surfaces during deployment / restore, not during normal request flow.

## Super detailed description

- **Why this is real:** directory listing confirms the duplicate prefixes. CLAUDE.md explicitly proscribes the pattern.
- **Affected files / endpoints:** the migrations directory; impact materializes on `supabase db reset` / new environment / production restore.
- **Origin:** `test_sec_audit.md` SEC-012. Confirmed.

## Brief explanation of solution

Rename the duplicate prefixes to monotonic ones (or migrate to timestamped names per CLAUDE.md), then verify against staging via `supabase migration list` that the production deploy order matches what the new names imply. This is a renaming-only change; no DDL re-runs.

---

## Issue

A-18. `chat-media/sign` and `dm/media-url` issue signed URLs with no rate limit.

## How critical is that issue

**Medium-Low.** Storage cost amplification + signed-URL flooding by an enrolled (or DM-participant) attacker. Not unauthorized access — the routes auth & authorize correctly — but they don't gate request volume.

## What is causing them

- `app/api/chat-media/sign/route.ts`: end-to-end has `verifyTokenAndGetUser` + admin/lecturer/enrolled/project-access authorization, but no `*Limiter.check(...)` call.
- `app/api/dm/media-url/route.ts`: same shape — `verifyTokenAndGetUser` + dm-participant check, no rate limit.

For comparison, `app/api/notifications/route.ts:25` uses `notificationLimiter.check(user.id)` (60/60s) with the same auth layout.

## Impact on website

Cost amplification (Supabase Storage signed-URL generation; possibly downstream egress costs). Bulk-mirror of course chat / DM media outside the platform — though enrollment-level access is required to begin with.

## Super detailed description

- **Why this is real:** read both files; no `*Limiter` import.
- **Affected files / endpoints:**
  - `app/api/chat-media/sign/route.ts`.
  - `app/api/dm/media-url/route.ts`.
- **Origin:** `test_sec_audit.md` SEC-011 and `docs/security-audit-2026-05-07.md` M-10 — same finding.

## Brief explanation of solution

Wrap each route with a per-user rate limiter — `notificationLimiter.check(user.id)` (60/60s) is the closest existing pattern. Same fail-closed wiring as elsewhere; no UI change.

---

## Issue

A-19. `app/api/complete-profile/route.ts` uses `createServiceRoleClient(token)` for the profile UPDATE, bypassing the privileged-column triggers.

## How critical is that issue

**Low.** Defense-in-depth concern. Today's `updatePayload` is whitelisted (`username`, `profile_completed`, `terms_accepted`, `terms_accepted_at`, `marketing_emails_consent`, `marketing_emails_consent_at`, plus `lecturer_status`/`is_approved` for the lecturer path). No privileged column is currently written. The defense relies entirely on a future contributor not adding `role` (or any other privileged column) to the payload.

## What is causing them

File `app/api/complete-profile/route.ts:42` uses `createServiceRoleClient(token)`. Service-role client bypasses every PostgREST trigger (`protect_profiles_role`, `protect_profiles_privileged_columns`, `protect_profiles_kyc_status`).

## Impact on website

None today. Brittle: a future PR that broadens the payload (e.g. accidentally adds `role`) would silently grant escalation, since the service-role client doesn't go through the trigger that would otherwise stop it.

## Super detailed description

- **Why this is real:** verified by file read. The audit's analysis is correct.
- **Affected files / endpoints:** `app/api/complete-profile/route.ts`.
- **Origin:** `test_sec_audit.md` SEC-007. Confirmed.

## Brief explanation of solution

Use the user-scoped `createServerSupabaseClient(token)` for the profile UPDATE. RLS allows authenticated users to UPDATE their own profile row; the privileged-column triggers will then catch any future drift. The existing payload remains valid because `username`, `profile_completed`, `terms_accepted*`, `marketing_emails_consent*` are all in the user-mutable column set under RLS. The `lecturer_status`/`is_approved` path needs a special exception — extract that into a dedicated SECURITY DEFINER admin RPC (or keep the service-role client only for that branch, gated by an explicit `if (role === 'lecturer')`). UI unchanged.

---

## Issue

A-20. `create_withdrawal_request` does not enforce IBAN format on `p_bank_account_number`; the regex check exists only on the API route.

## How critical is that issue

**Low.** No theft — the recipient bank account number is set by the caller themselves, against their own balance. Impact is admin workflow disruption (admin sees a malformed IBAN, tries to process, the bank rejects, manual cleanup).

## What is causing them

- `create_withdrawal_request` body (verified) inserts `p_bank_account_number` verbatim.
- `app/api/withdrawals/route.ts` regex-validates `^GE[0-9]{2}[A-Z]{2}[0-9]{16}$` before calling the RPC.
- A direct `POST /rest/v1/rpc/create_withdrawal_request` bypasses the route validation.

## Impact on website

Admin queue clutter; not a theft path.

## Super detailed description

- **Why this is real:** RPC body confirmed via `pg_get_functiondef`; route confirmed via file read.
- **Affected files / endpoints:**
  - DB: `create_withdrawal_request(numeric, text)`.
  - Server: `app/api/withdrawals/route.ts:108`.
- **Origin:** `test_sec_audit.md` SEC-008. Confirmed.

## Brief explanation of solution

Add the same regex check inside the RPC body (`IF p_bank_account_number !~ '^GE[0-9]{2}[A-Z]{2}[0-9]{16}$' THEN RAISE EXCEPTION ...; END IF;`) so both API and RPC enforce it. UI is unchanged — the API path already returns the right error message; this just closes the direct-PostgREST bypass.

---

## Issue

A-21. `app/api/admin/payments` (GET, POST) lacks a rate limiter; `app/api/admin/settings` GET lacks an admin gate (any authed user can read it, including the admin user UUID in `updated_by`).

## How critical is that issue

**Low.** Defense-in-depth + admin enumeration adjunct (combined with A-22).

## What is causing them

- `app/api/admin/payments/route.ts:13-29, 63-79`: admin RPC gate present; no `adminLimiter.check(user.id)` after the gate. (For comparison, `app/api/admin/notifications/send/route.ts:325-326` calls `adminLimiter.check(user.id)` immediately after the admin check.)
- `app/api/admin/settings/route.ts:25-50`: only `verifyTokenAndGetUser`, no `verifyAdminRequest`. Any authenticated user receives `min_withdrawal_gel`, `subscription_price_gel`, `featured_course_id`, `updated_at`, **`updated_by`** (admin user UUID).

## Impact on website

- `admin/payments`: a compromised admin token could list/replay manual completions without rate-limit pressure (low).
- `admin/settings` GET: leaks the admin user's UUID to any logged-in student. Combined with `check_is_admin` granted to anon (A-22), enables enumeration of who is admin — useful for targeted phishing / credential stuffing.

## Super detailed description

- **Why this is real:** both files read end-to-end.
- **Affected files / endpoints:**
  - `app/api/admin/payments/route.ts`.
  - `app/api/admin/settings/route.ts:25-50`.
- **Origin:** `docs/security-audit-2026-05-07.md` M-03 and M-08, merged.

## Brief explanation of solution

- For `admin/payments`: after the `check_is_admin` gate, call `adminLimiter.check(user.id)` and return `rateLimitResponse(retryAfterMs)` on 429.
- For `admin/settings` GET: either restrict to admins (preferred — the settings being public are minimal and the route is mainly used by admin UI), OR strip `updated_by` and `updated_at` from the response when the caller is not an admin. Public-relevant fields (`min_withdrawal_gel`, `subscription_price_gel`, `featured_course_id`) are unchanged for the existing client UI.

---

## Issue

A-22. Referral and admin-status RPCs are granted to `anon` / `PUBLIC`; combined with the existence-distinguishing referral-code endpoint, they support enumeration.

## How critical is that issue

**Low.** Anon enumeration of referral codes and admin UUIDs.

## What is causing them

Verified `routine_privileges`:

- `check_is_admin(uuid)` — EXECUTE granted to `anon`.
- `has_project_access(uid)` — EXECUTE granted to `anon`.
- `auto_generate_referral_code()` — EXECUTE granted to `PUBLIC` and `anon`.
- `generate_referral_code()` — EXECUTE granted to `PUBLIC` and `anon`.

Plus the existence distinguisher: `app/api/validate-referral-code/route.ts:92-95` returns `{ valid: !!profile, message: ... }` after a per-IP `referralLimiter` (10/60s) and 100-200ms jitter. The route requires authentication, but `app/api/public/validate-referral-code/route.ts` is the unauthenticated counterpart — same shape.

## Impact on website

- Anon caller can enumerate the referral code namespace by brute force (small alphanumeric space, see audit Q7 for namespace estimation), bounded by the 10/60s per-IP rate limit.
- Anyone holding a UUID can determine if it's an admin via `POST /rest/v1/rpc/check_is_admin?user_id=<uuid>`. Combined with A-21 (admin/settings GET leaking the admin's UUID to any authed user), this becomes a one-step admin identification.

## Super detailed description

- **Why this is real:** `routine_privileges` query confirmed for each function. Route file read.
- **Affected files / endpoints:**
  - DB: `check_is_admin`, `has_project_access`, `auto_generate_referral_code`, `generate_referral_code`.
  - Server: `app/api/validate-referral-code/route.ts`, `app/api/public/validate-referral-code/route.ts`.
- **Origin:** `test_sec_audit.md` SEC-013, `docs/security-audit-2026-05-07.md` L-02, L-03, M-04 — merged.

## Brief explanation of solution

- `REVOKE EXECUTE ON FUNCTION public.check_is_admin(uuid) FROM anon;` and same for `has_project_access`. The legacy referral-code-check that needed anon should be moved behind a server route that already authenticates (or be replaced by signup-time validation only).
- `REVOKE EXECUTE ON FUNCTION public.auto_generate_referral_code(), public.generate_referral_code() FROM PUBLIC, anon;` — these are trigger-side functions, the user does not need to call them directly.
- For the referral-code validators, either return a uniform "Invalid or unknown" message AND keep the per-IP rate limit, or rely on signup-time validation only (drop the standalone validate endpoint).

UI changes: the referral-code field can keep showing "Valid" / "Invalid" client-side based on signup outcome; intermediate "is this code valid?" checks become uniform-response.

---

## Issue

A-23. `supabase/functions/health/index.ts` uses non-timing-safe string comparison for the health-secret header.

## How critical is that issue

**Low.** Crypto hygiene. The endpoint is gated by `HEALTH_CHECK_SECRET` env-var presence, the detailed payload contains DB latency only (no PII), and the secret is server-set, so practical exploitation requires a network-attacker timing the response across many guesses — improbable but easy to fix.

## What is causing them

`supabase/functions/health/index.ts:31`:

```ts
if (healthSecret && req.headers.get("x-health-secret") !== healthSecret) {
```

Direct `!==` string compare. Contrast `view-scraper/index.ts:147-154` which uses `crypto.subtle.timingSafeEqual` correctly.

## Impact on website

At worst, an attacker who can observe response timings could guess the secret over many requests and read the detailed health payload (DB latency + status flags). No PII or operational secrets are exposed in the payload.

## Super detailed description

- **Why this is real:** file read confirmed.
- **Affected files / endpoints:** `supabase/functions/health/index.ts`.
- **Origin:** `docs/security-audit-2026-05-07.md` M-05. Confirmed; severity downgraded to Low.

## Brief explanation of solution

Replace the `!==` with `crypto.subtle.timingSafeEqual` over `TextEncoder().encode()` of both strings (mirroring the helper in `view-scraper/index.ts`). UI unchanged.

---

## Issue

A-24. `coming_soon_emails`, `email_send_history`, `submission_reviews` are members of the `supabase_realtime` publication; latent leak if RLS is later relaxed.

## How critical is that issue

**Low.** Today, RLS for `coming_soon_emails` and `email_send_history` is admin-only on SELECT (audit-verified, confirmed); for `submission_reviews`, see A-9 (broad SELECT policy needs to be dropped). The risk is forward-looking: realtime broadcasts row-level events to subscribers that pass RLS — if a future RLS change relaxes SELECT, the realtime channel becomes a live PII firehose to subscribers.

## What is causing them

`pg_publication_tables` query confirmed: `coming_soon_emails`, `email_send_history`, `submission_reviews`, `profiles` are all in `supabase_realtime`. Client code does not subscribe to `coming_soon_emails` or `email_send_history` (audit's spot-check via `rg`).

## Impact on website

None today. Latent.

## Super detailed description

- **Why this is real:** publication membership query confirmed.
- **Affected files / endpoints:** `supabase_realtime` publication membership.
- **Origin:** `docs/security-audit-2026-05-07.md` M-11. Confirmed; severity Low because no client subscribes today.

## Brief explanation of solution

`ALTER PUBLICATION supabase_realtime DROP TABLE public.coming_soon_emails, public.email_send_history;`. Verify no client code subscribes via `rg "channel.*(coming_soon_emails|email_send_history)" components hooks app`. UI unchanged.

(Don't drop `submission_reviews` from the publication unless you also fix A-9 — they're independent.)

---

## Issue

A-25. Account deletion does not anonymize `withdrawal_requests.user_id`; orphan rows accumulate.

## How critical is that issue

**Low.** Data hygiene. Not exploit-driven, but referenced because LC-01 (A-2) is partially mitigated by closing this loop.

## What is causing them

`app/api/account/delete/route.ts`:

- Lines 79-93: anonymizes `payment_audit_log.user_id` to NULL.
- Lines 95-109: anonymizes `keepz_payments.user_id` to NULL.
- Does not touch `withdrawal_requests.user_id`.

`auth.admin.deleteUser` then removes the auth row. The `withdrawal_requests` rows are orphaned (FK is to a row that no longer exists in `auth.users` — the `profiles` row is also gone via cascade).

## Impact on website

Orphan rows in `withdrawal_requests` reference deleted users. Admin views may show entries with no resolvable user. GDPR/Right-to-be-forgotten residual data.

## Super detailed description

- **Why this is real:** file read confirmed.
- **Affected files / endpoints:** `app/api/account/delete/route.ts`.
- **Origin:** `docs/security-audit-2026-05-07.md` L-11. Confirmed.

## Brief explanation of solution

Add a third anonymization step after the `keepz_payments` one:

```ts
await serviceSupabase
  .from("withdrawal_requests")
  .update({ user_id: null })
  .eq("user_id", user.id);
```

Or, if `withdrawal_requests` has any non-null FK constraint on `user_id` (verify first via `\d withdrawal_requests`), update it to nullable in the same migration. UI unchanged.

---

## Issue

A-26. `lib/email-templates.ts:44` hardcodes `const SITE_URL = "https://wavleba.ge";` — the typo for `swavleba.ge`.

## How critical is that issue

**Low.** UX/phishing. Not currently exploitable because the typo domain is unregistered, but if registered by an adversary it becomes a phishing redirect target embedded in genuine Swavleba transactional emails.

## What is causing them

Direct typo at `lib/email-templates.ts:44`. The constant is used in the email wrapper at line 61: `<a href="${SITE_URL}" style="...">wavleba.ge</a>`.

## Impact on website

If an attacker registers `wavleba.ge` (single-letter typo of the real domain), every transactional email sent by the platform contains a footer link to attacker-controlled territory. Users clicking the "wavleba.ge" link in their welcome / receipt / KYC / withdrawal email land on the attacker's site.

## Super detailed description

- **Why this is real:** file read confirmed.
- **Affected files / endpoints:** `lib/email-templates.ts:44, 61`.
- **Origin:** `test_sec_audit.md` SEC-016. Confirmed.

## Brief explanation of solution

Change the constant to the correct domain. As defense-in-depth, source it from `process.env.NEXT_PUBLIC_APP_URL` (already used elsewhere) so the email render and the rest of the app share a single source of truth. UI of emails unchanged (the rendered text "wavleba.ge" in the visible link should also be updated to "swavleba.ge").

---

# Section B — Additional independently-discovered validated issues

No additional **High** or **Critical** issues emerged from the independent pass. The only meaningful additional discovery is **ADD-01**, which is a strict extension of A-8: the `column_privileges` query during this validation pass confirmed that `email`, `full_name`, `bank_account_number`, `encrypted_email`, `encrypted_full_name`, `encrypted_bank_account_number` all carry `UPDATE` granted to `authenticated` and are NOT covered by `protect_profiles_privileged_columns`. Since the original audits' M-12 already names a subset of these columns, this guide folds the broader column list into A-8 above to avoid duplication. The `email`-injection-into-admin-views attack scenario is described inside A-8.

The audits were comprehensive on RLS, RPC bodies, route patterns, and dependency posture. Items I scanned for and did not find new evidence of: SQL injection (Supabase client parameterizes; no string concatenation observed), XSS via dangerouslySetInnerHTML (only theme-init + Meta Pixel, both static + nonce-protected per audit POSITIVE-O), eval / new Function (none found per regex sweep — audit POSITIVE-P), open redirect (validateRedirectUrl is solid — audit I-13), CSRF (Bearer-token API surface; no cookie-bearing state-changing endpoints outside the auth flow which Supabase Auth handles), hardcoded secrets (regex sweep returned 0 — audit POSITIVE-Q + I-15).

---

# Appendix — Original-audit IDs not validated (excluded as vulnerabilities)

These claims appeared in `test_sec_audit.md` and/or `docs/security-audit-2026-05-07.md` but did NOT meet the validation standard set out in the user's instructions. They are listed neutrally — **none of these are vulnerabilities** in this final guide.

| Original ID | One-line reason for exclusion                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-014     | Account-impacting routes rate-limit by IP rather than user.id; the audit's worst case is "NAT'd users lock each other out". Not a security exploit; the directly-exploitable rate-limit gap is captured in A-18.                                                                                                                                                                                                                        |
| SEC-015     | The audit's own regex sweep for hardcoded JWTs / API keys / PEM headers across `app lib components scripts supabase/functions hooks contexts` returned 0 hits. Logging admin user IDs / target IDs at INFO level is not a vulnerability.                                                                                                                                                                                                |
| SEC-017     | Pre-RPC status check at the route layer is described in the audit text as "purely cosmetic; the RPC's `FOR UPDATE` + `status='pending'` fence handles atomicity." No exploit.                                                                                                                                                                                                                                                           |
| SEC-018     | `style-src 'unsafe-inline'` is documented in `middleware.ts:24-29` as an accepted Tailwind trade-off. Script-src is nonce-based and prod-strips `unsafe-eval`.                                                                                                                                                                                                                                                                          |
| M-01        | `decrypt_pii` returning NULL silently on missing vault key is operational/observability, not exploit-relevant. Vault-key absence is not a path an attacker reaches.                                                                                                                                                                                                                                                                     |
| M-06        | The audit's claim that `target_user_ids` is "passed straight" to `send_bulk_notifications` is incorrect: `app/api/admin/notifications/send/route.ts:411-435` already validates UUID shape per element and caps the array at 100 entries. The audit's residual concern (existence pre-check) is admin-only and does not constitute a vulnerability.                                                                                      |
| M-07        | KYC submit not writing a user-side audit log is a forensics gap, not an exploitable security flaw.                                                                                                                                                                                                                                                                                                                                      |
| L-01        | `middleware.ts:5,15` uses `pathname.startsWith("/api/payments/keepz/callback")`. No sibling route shadows it today. Hardening, not a current vulnerability.                                                                                                                                                                                                                                                                             |
| L-04        | `lib/supabase-server.ts:24-30` throws `FATAL` in production when `SUPABASE_SERVICE_ROLE_KEY` is unset, so the `fallbackToken` branch is dead code in production. The route in question (`app/api/kyc/cleanup/route.ts:47`) is therefore not exploitable.                                                                                                                                                                                |
| L-05        | Same as L-04 for `app/api/admin/withdrawals/[requestId]/{approve,reject}/route.ts`.                                                                                                                                                                                                                                                                                                                                                     |
| L-06        | `protect_profiles_kyc_status`'s `pg_trigger_depth() = 1` heuristic is described in the audit as "fragile if a future trigger introducing a deeper call chain is added"; speculative, no current exploitability.                                                                                                                                                                                                                         |
| L-07        | IBAN regex without ISO 13616 mod-97 checksum is UX, not security.                                                                                                                                                                                                                                                                                                                                                                       |
| L-08        | `verify_jwt: false` is the documented per-function pattern when the function authenticates via `getAuthenticatedUser`. CLAUDE.md describes this as the standard convention.                                                                                                                                                                                                                                                             |
| L-09        | `app/api/admin/payments/route.ts:46`: `.eq("status", statusFilter)` — Supabase parameterizes this. The audit's framing ("if a future change concatenates the value, SQLi risk emerges") is hypothetical.                                                                                                                                                                                                                                |
| L-10        | Cosmetic comment about per-language vs total byte cap on `sanitize-html`. Not a security issue.                                                                                                                                                                                                                                                                                                                                         |
| L-12        | Stale edge function deployments (`friend-requests`, `blocked-users`) referenced in the audit's MCP listing do not have local source under `supabase/functions/`. Their remote-deployed bodies cannot be verified from this side without dashboard access. **Not validated** in this guide; recommend the user open each in Supabase Dashboard → Functions, verify the source matches the current branch, and either redeploy or delete. |
| L-13, L-14  | `course-thumbnails` and `avatars` buckets are public by design (course catalog display, avatar rendering). Audit confirms intentional.                                                                                                                                                                                                                                                                                                  |

---

## Verification quick-reference

To re-verify any A-\* finding against production (`nbecbsbuerdtakxkrduw`), run the cited query against production read-only and compare. Key checks:

| Finding  | Production verification                                                                                                                                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A-1      | `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='protect_profiles_privileged_columns' AND pronamespace='public'::regnamespace;` — grep body for `welcome_discount_expires_at`. Zero matches = A-1 still applies.                                                          |
| A-3      | `SELECT routine_name, grantee, privilege_type FROM information_schema.routine_privileges WHERE routine_name='get_safe_profiles';` — `authenticated` present in grantees = A-3 still applies.                                                                                         |
| A-4      | `npm audit --omit=dev`.                                                                                                                                                                                                                                                              |
| A-5..A-7 | `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname IN ('complete_keepz_payment','approve_project_subscription','approve_bundle_enrollment_request','approve_enrollment_request','reject_enrollment_request');` — read body, look for the patterns described in each finding. |
| A-8      | `SELECT column_name, privilege_type, grantee FROM information_schema.column_privileges WHERE table_schema='public' AND table_name='profiles' AND grantee='authenticated' AND privilege_type='UPDATE';` — verify the listed columns are present. Then read trigger body as in A-1.    |
| A-9      | `SELECT policyname, cmd, qual FROM pg_policies WHERE schemaname='public' AND tablename='submission_reviews' AND cmd='SELECT';` — broad policy with `qual = (SELECT auth.uid()) IS NOT NULL` = A-9 still applies.                                                                     |
| A-16     | `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='saved_cards';` — single-column UNIQUE on `card_token` = A-16 still applies.                                                                                                                     |
| A-22     | `SELECT routine_name, grantee FROM information_schema.routine_privileges WHERE routine_name IN ('check_is_admin','has_project_access','auto_generate_referral_code','generate_referral_code') AND grantee IN ('anon','PUBLIC');` — any rows = A-22 still applies.                    |
| A-24     | `SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename IN ('coming_soon_emails','email_send_history');` — any rows = A-24 still applies.                                                                                                       |

All other findings are file-line references — open the cited file at the cited line.
