# Swavleba Security Audit — 2026-05-07

**Branch audited:** `deps/security-fixes-staging`
**Live DB inspected:** Supabase staging `bvptqdmhuumjbyfnjxdt` (read-only).
**Production (`nbecbsbuerdtakxkrduw`) not queried** — findings are written assuming staging schema reflects production. Where staging ≠ prod is plausible, the finding is marked Latent and re-verification SQL is given.
**Mode:** read-only. Zero source edits, zero deploys.

---

## 1. Executive summary

The platform is in a **substantially better** state than a typical "first audit" — RLS is enabled on every public table, `handle_new_user` correctly hardcodes `role='student'`, all 65 SECURITY DEFINER functions have explicit `search_path = public, pg_temp`, plaintext PII columns are NULL across all 3 staging profiles after the encryption migration, and the Keepz callback handler implements signature verification + status fences + amount-equality + idempotency in `complete_keepz_payment`. Storage buckets are privatized for chat-media (mig 235), DM media (mig 224), course videos (mig 125), KYC documents (mig 215), payment screenshots (mig 122). Edge function CORS uses an allowlist (no `*`) and admin-\* functions all gate on `checkIsAdmin` before writes.

**Verdict: 1 Critical found.** The trigger `protect_profiles_privileged_columns` does not cover `welcome_discount_expires_at`, so any authenticated user can extend their welcome-discount window indefinitely via a direct PostgREST `PATCH /rest/v1/profiles?id=eq.<self>` — this is exploitable today, requires no special access, and discounts every future payment.

A second Critical-class concern (signup→delete→signup loop refreshing welcome-discount and project-access windows) is partially mitigated by the same finding's fix but remains exploitable through a different path; see L-CRIT-2.

Five High and twelve Medium findings cluster around: (a) admin RPCs that lack `FOR UPDATE` row locks or status-fenced UPDATEs (concurrent admin double-process risk, esp. enrollment / bundle / project subscription), (b) `saved_cards` card_token uniqueness scoped globally rather than per-user (cross-user card overwrite if Keepz reuses tokens), (c) `complete_keepz_payment`'s outer `EXCEPTION WHEN OTHERS` block can leave a payment in `status='success'` while business logic (enrollment / balance credit) silently fails, (d) Next.js 14.2.35 has a published HIGH-severity DoS CVE, (e) account deletion permits immediate re-registration with no cooldown.

The verdict's "1 Critical" depends on `protect_profiles_privileged_columns` not being silently extended in production (verify §10 query Q1). If production has a different version that does cover the missing columns, the finding downgrades to Latent Critical.

---

## 2. Top-5 risks (severity-ordered, exploitability-ordered within tier)

| #   | ID    | Severity     | Title                                                                                                                           | Exploitability today                   |
| --- | ----- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | C-01  | **Critical** | `welcome_discount_expires_at` mutable by user — permanent free-discount via PATCH                                               | Any authed user, no special role       |
| 2   | LC-01 | Latent Crit  | Signup→delete→signup loop refreshes welcome discount + 1-month project access                                                   | Any authed user, multi-step            |
| 3   | H-01  | High         | `saved_cards.card_token` UNIQUE only on token, not `(user_id, token)` — cross-user clobber on callback upsert                   | Depends on Keepz token-reuse semantics |
| 4   | H-02  | High         | `approve_project_subscription` / `approve_bundle_enrollment_request` lack status fence — re-approve loop drains lecturer/budget | Compromised or rogue admin             |
| 5   | H-03  | High         | `complete_keepz_payment` outer EXCEPTION block leaves status='success' even when enrollment+credit fail                         | Any user during transient DB error     |

The most important Phase B query the next reviewer should run TODAY:

```sql
-- Verify protect_profiles_privileged_columns covers welcome_discount_expires_at
-- in PRODUCTION (run against nbecbsbuerdtakxkrduw):
SELECT pg_get_functiondef(oid) FROM pg_proc
WHERE proname = 'protect_profiles_privileged_columns'
  AND pronamespace = 'public'::regnamespace;
-- Then grep the body for: welcome_discount_expires_at, signup_referral_code,
-- referred_for_course_id, referral_code, terms_accepted, marketing_emails_consent_at.
-- Each missing column = direct user-mutation vector.
```

---

## 3. Threat model

In scope:

- Anonymous attackers (anon role on PostgREST + edge functions)
- Authenticated students (default role on signup)
- Pending lecturers (`is_approved=false`, `lecturer_status='pending'`)
- Approved lecturers
- Admins (insider threat / compromised account)
- Keepz webhook (semi-trusted; signature-verified)
- DigitalOcean App Platform proxy (trusted; XFF parsed with `TRUSTED_PROXY_HOPS=1`)

Crown jewels:

- Real money on `profiles.balance` and `withdrawal_requests`
- KYC documents in `kyc-documents` bucket + decrypted PII via `decrypt_pii`
- Course revenue and lecturer payouts (via `complete_keepz_payment` → `credit_user_balance`)
- Admin role escalation (any path to `profiles.role='admin'`)
- Saved card tokens in `saved_cards` (proxy for live PANs)

Out of scope (this audit):

- Production Supabase project (not queried)
- Network / WAF layer
- DigitalOcean platform misconfiguration
- Keepz API security itself
- Third-party JS dependencies (PostHog client, Resend client)

---

## 4. Critical findings

### C-01 — `welcome_discount_expires_at` is user-mutable; permanent welcome discount

- **Severity**: Critical
- **Category**: Authorization / RLS / Trigger drift
- **Location**: `supabase/migrations/*protect_profiles_privileged_columns*.sql` (migration 20260505073957) — see also live `pg_get_functiondef('public.protect_profiles_privileged_columns')`
- **Vulnerability**: The RLS policy on `profiles` "Users can update own profile" allows a user to PATCH every column on their own row (USING `auth.uid() = id`, no `WITH CHECK`). Column-level protection is delegated to three BEFORE-UPDATE triggers. The relevant trigger `protect_profiles_privileged_columns` (verified live) blocks edits to: `balance`, `is_approved`, `lecturer_status`, `project_access_expires_at`, `can_create_free_projects`, `profile_completed`. **It does NOT cover `welcome_discount_expires_at`.**

  Ground truth body (live):

  ```
  IF NEW.welcome_discount_expires_at IS DISTINCT FROM OLD.welcome_discount_expires_at THEN ...  -- ABSENT
  ```

  `app/api/payments/keepz/create-order/route.ts` reads `welcome_discount_expires_at` from `profiles` to decide whether to apply a discount on `course_enrollment` and `bundle_enrollment` payments (verified by Tier-1 deep-read; the discount window check at `create-order/route.ts:56` reads the column directly).

- **Impact**: Any authenticated user issues:

  ```
  PATCH /rest/v1/profiles?id=eq.<self>
  Authorization: Bearer <user_jwt>
  Content-Type: application/json

  { "welcome_discount_expires_at": "2099-12-31T00:00:00Z" }
  ```

  RLS USING passes (auth.uid() = id), no WITH CHECK to fail, no protect-trigger column listed → UPDATE succeeds. Every subsequent `create-order` call sees a still-valid discount window and applies the welcome discount to all course/bundle purchases — indefinitely.

  Direct revenue loss: full welcome-discount percentage off every paid enrollment for every user who runs the PATCH. Discoverable by anyone reading the welcome-discount logic in the codebase or by trial-and-error against a public schema.

- **Reproduction (read-only, do not run on prod):**

  ```sql
  -- Confirm the trigger does NOT mention the column in production:
  SELECT pg_get_functiondef(oid) FROM pg_proc
  WHERE proname='protect_profiles_privileged_columns'
    AND pronamespace='public'::regnamespace;
  -- grep output for 'welcome_discount_expires_at' — expect zero matches
  ```

  Then in a non-production browser console as any signed-in user:

  ```js
  fetch(`${supaUrl}/rest/v1/profiles?id=eq.${myUserId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: anonKey,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      welcome_discount_expires_at: "2099-12-31T00:00:00Z",
    }),
  })
    .then((r) => r.json())
    .then(console.log);
  ```

  Expect `200` with the new value reflected. Then create a course-enrollment payment and observe discount applied.

- **Recommendation**: Extend `protect_profiles_privileged_columns` to also block (raise `42501`) on changes to: `welcome_discount_expires_at`, `signup_referral_code`, `referred_for_course_id`, `terms_accepted`, `terms_accepted_at`, `marketing_emails_consent_at`, `referral_code`, `email`, `full_name`, `encrypted_email`, `encrypted_full_name`, `encrypted_bank_account_number`, `bank_account_number`, `kyc_status` (already covered by separate trigger; explicit overlap is fine). Allowed user-mutable columns should be exactly: `username`, `avatar_url`. Bank account number and marketing consent should mutate via dedicated RPCs (`/api/balance` PATCH already exists for bank account). Verify in tests by attempting each PATCH and asserting `42501`.

- **References**: CWE-639 (Authorization Bypass Through User-Controlled Key), OWASP API1:2023 (Broken Object Level Authorization), https://supabase.com/docs/guides/auth/row-level-security#how-rls-works (WITH CHECK semantics).

---

## 5. Latent Critical findings

### LC-01 — Signup→delete→signup loop refreshes welcome discount + 1-month project access

- **Severity**: Latent Critical
- **Category**: Business logic / Account lifecycle abuse
- **Location**:
  - `handle_new_user()` body (verified live, see §11):
    - `project_access_expires_at = NOW() + INTERVAL '1 month'` (set on every email signup)
    - `welcome_discount_expires_at = NOW() + INTERVAL '12 hours'` (set on every email signup)
  - `app/api/account/delete/route.ts:74` calls `serviceSupabase.auth.admin.deleteUser(user.id)` (hard delete; cascades to `profiles`)
  - No re-registration cooldown exists. The `coming_soon_emails` and `audit_log` rows the deletion creates do not block re-signup with the same email.
- **Vulnerability**: User signs up → consumes welcome discount + free month of project access → deletes account → immediately re-signs up with the same email (Supabase Auth allows it because the auth user was hard-deleted) → trigger fires again, granting a fresh 12h discount window and a fresh 1-month project access. Project access is also extended in `complete_keepz_payment` for paid users; for non-paying users this loop is the only path to keep accumulating free months.
- **Impact**:
  - Free welcome-discount on every cycle (~12h cooldown).
  - Free 1-month project access refresh on every cycle.
  - `audit_log` of `self_account_deleted` survives, but doesn't block new account creation.
  - `withdrawal_requests` survives with `user_id` not nulled (account/delete only nulls `payment_audit_log` and `keepz_payments` user_id; `withdrawal_requests` is untouched per Tier-2 review). Orphan rows.
- **Reproduction**: see §10 Q2.
- **Recommendation**:
  1. Move `welcome_discount_expires_at` initialisation OUT of `handle_new_user` and INTO the path that converts a signup into a verified email user (so unverified-email signup loops don't qualify), AND track this on a separate `welcome_discount_used` table keyed by **normalised email address** (lowercase, plus-stripped) AND/or by IP fingerprint, so re-registration with the same effective email cannot reset.
  2. Same for `project_access_expires_at` first month — gate behind a per-email "first signup ever" check.
  3. On account/delete, write a tombstone row (e.g. `deleted_emails` table with `email_normalized`, `deleted_at`) that the next signup attempt checks; allow re-registration only after a 30-day cooldown OR with admin review.
  4. NULL `withdrawal_requests.user_id` on delete (currently leaves orphan rows referencing deleted user).
- **References**: CWE-841 (Improper Enforcement of Behavioral Workflow), OWASP A04:2021 (Insecure Design).

---

## 6. High findings

### H-01 — `saved_cards.card_token` UNIQUE on token alone, not `(user_id, token)`

- **Severity**: High (Latent — exploitability depends on Keepz token semantics)
- **Location**:
  - Live index inventory (verified): `idx_saved_cards_token` is `CREATE UNIQUE INDEX ON public.saved_cards USING btree (card_token)` — single column, not composite.
  - `app/api/payments/keepz/callback/route.ts:~334` — upsert `onConflict: "card_token"`
- **Vulnerability**: If Keepz issues the same `card_token` for the same physical card across two different paying users (a typical tokenization scheme keys on PAN), then User-B's successful payment with `saveCard=true` will UPSERT — which under `ON CONFLICT card_token` updates `user_id` to B, silently deleting A's saved-card record from the user's perspective. Worse, B can now charge that token; A loses their saved card without notification.
- **Impact**:
  - User A's saved card "disappears" from their saved-cards list after User B saves the same physical card.
  - Cross-user card-token usage if any code path looks up cards by token alone (it doesn't currently — `app/api/payments/saved-cards/route.ts` filters `eq("user_id", user.id)`), but the data integrity issue is sufficient on its own.
- **Reproduction**: Cannot verify Keepz token semantics from this side. See §10 Q3.
- **Recommendation**:
  1. Drop `idx_saved_cards_token` and add `CREATE UNIQUE INDEX idx_saved_cards_user_token ON public.saved_cards (user_id, card_token)` instead.
  2. In `keepz/callback/route.ts`, change `onConflict: "card_token"` to `onConflict: "user_id,card_token"`.
  3. Add a migration to run an audit query: rows where the same card_token appears across multiple users. If any exist today, those are paid-card overwrites.
- **References**: CWE-732 (Incorrect Permission Assignment for Critical Resource), CWE-840 (Business Logic Errors).

### H-02 — `approve_project_subscription` and `approve_bundle_enrollment_request` lack status fences

- **Severity**: High
- **Location**: live `pg_get_functiondef('public.approve_project_subscription')` and `pg_get_functiondef('public.approve_bundle_enrollment_request')` — both overloads.
- **Vulnerability**: Per the RPC body audit (Phase A4 verification):
  - `approve_project_subscription`: SELECT and UPDATE both target `WHERE id = subscription_id`. **No `status='pending'` fence anywhere.** Re-calling it on an already-approved subscription extends `expires_at = NOW() + INTERVAL '1 month'` again and runs `profiles.project_access_expires_at = GREATEST(...) + INTERVAL '1 month'` again. Each call adds another month.
  - `approve_bundle_enrollment_request` (no-param overload): SELECT has no status check; UPDATE WHERE id only. Re-approve credits the lecturer balance again via the path inside the bundle approval (depending on whether bundle approval triggers the credit, which it doesn't directly, but `complete_keepz_payment` recovery does — see H-03).
  - `approve_bundle_enrollment_request` (with `admin_user_id` overload): Status checked AFTER fetch but UPDATE has no `AND status='pending'` in WHERE — TOCTOU.
- **Impact**: A compromised or rogue admin (or insider) clicks "Approve" repeatedly on the same record and accumulates project access months. With the bundle path, this can also re-trigger `complete_keepz_payment` recovery flows that re-credit lecturer balances if the upstream payment row is in a state that allows recovery.
- **Reproduction**: See §10 Q4.
- **Recommendation**:
  - Add `AND status = 'pending'` to the UPDATE WHERE clause in all three functions.
  - Add `FOR UPDATE` on the SELECT (consistent with `approve_withdrawal_request` / `approve_kyc_submission` which already do this correctly).
  - Surface `RAISE EXCEPTION` if `ROW_COUNT = 0` after the UPDATE so the admin sees a clear "already processed" error.
- **References**: CWE-367 (TOCTOU), CWE-841 (Improper Enforcement of Behavioral Workflow).

### H-03 — `complete_keepz_payment` outer EXCEPTION leaves `status='success'` while business logic fails

- **Severity**: High
- **Location**: live `pg_get_functiondef('public.complete_keepz_payment')` — the outer block does:
  ```
  UPDATE keepz_payments SET status='success', paid_at=NOW(), ... WHERE id=v_payment.id;
  -- ...then the BEGIN block that does enrollment + balance credit:
  BEGIN
    ... INSERT enrollments ... credit_user_balance ...
  EXCEPTION WHEN OTHERS THEN
    PERFORM log_payment_event(...);
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'payment_recorded', true);
  END;
  ```
- **Vulnerability**: The status flip to `'success'` happens BEFORE the enrollment/credit transaction. If anything in the inner block raises (transient FK violation, deadlock, network issue calling another function, type mismatch) the outer catch returns a payload to the caller indicating `success: false, payment_recorded: true`. The keepz_payments row is left at `status='success'` — but the user has no enrollment and the lecturer has no balance credit. The next call to `complete_keepz_payment` for that order ID hits the early-return path (`v_payment.status = 'success'` → `already_completed: true`) and runs the recovery path — which only fires if the enrollment doesn't yet exist. So in theory recovery works… IF the recovery path itself doesn't hit the same exception. There's no retry queue and no admin alert.
- **Impact**: User paid, was charged on their card, payment row says success — but they have no course access and the lecturer hasn't been paid. Repro window: any RPC error during enrollment INSERT or credit_user_balance.
- **Reproduction**: §10 Q5 (count keepz_payments rows where status='success' but no matching `enrollments` row for course payments, no matching `balance_transactions` for the lecturer).
- **Recommendation**:
  1. Move the status flip INTO the BEGIN block so an exception rolls it back.
  2. Add a daily reconciliation job that finds `status='success'` keepz_payments lacking a matching enrollment / balance_transactions row and either retries the recovery path or alerts admin.
  3. The callback handler at `app/api/payments/keepz/callback/route.ts:256-295` already logs `[CRITICAL]` on the `payment_recorded === true` failure mode but doesn't alert; wire that to a notification.
- **References**: CWE-460 (Improper Cleanup on Thrown Exception), CWE-755 (Improper Handling of Exceptional Conditions).

### H-04 — `approve_enrollment_request` / `reject_enrollment_request` lack `FOR UPDATE` and have no status fence in UPDATE

- **Severity**: High
- **Location**: live RPC body inventory (Phase A4)
- **Vulnerability**: Same pattern as H-02 — SELECT checks `status='pending'` but UPDATE has no status condition. Two concurrent admin approve clicks both pass the SELECT and both run UPDATE; second UPDATE wins on the columns it touches but the side effects (credit_user_balance, enrollment INSERT with `ON CONFLICT DO UPDATE SET approved_at=NOW()`) execute twice — `balance_transactions` is not idempotency-keyed for enrollment_request_id, so double-credit is possible.
- **Impact**: Concurrent admin approvals or admin double-clicking can double-credit lecturer balance.
- **Reproduction**: See §10 Q6.
- **Recommendation**: Add `AND status='pending'` to UPDATE WHERE; add `FOR UPDATE` on the SELECT.
- **References**: CWE-362 (Concurrent Execution / Race Condition), CWE-841.

### H-05 — Next.js 14.2.35 has HIGH-severity DoS CVE; postcss XSS

- **Severity**: High (DoS only — no RCE)
- **Location**: `package.json` — `next: ^14.2.35`. Resolved via `npm audit --omit=dev`.
- **Vulnerability**:
  - GHSA-h25m-26qc-wcjf (HIGH, CVSS 7.5): "Next.js HTTP request deserialization can lead to DoS when using insecure React Server Components." Affects `>=13.0.0 <15.0.8`. 14.2.35 is in range.
  - GHSA-9g9p-9gw9-jx7f (MODERATE, CVSS 5.9): Image Optimizer DoS via remotePatterns. Affects `>=10.0.0 <15.5.10`.
  - postcss `<8.5.10`: GHSA-qx2v-qp2m-jg93 (MODERATE) — XSS via `</style>` in CSS Stringify Output.
- **Impact**: Single attacker can crash a Next.js worker / saturate the App Platform instance. postcss XSS is build-time only and impacts dev environments.
- **Reproduction**: not attempted; CVE pages have PoCs.
- **Recommendation**: Upgrade `next` to `^14.2.36+` (LTS branch backport) or jump to `15.x` if comfortable. Run `npm audit fix --omit=dev` (no `--force`) and verify with `npm audit --omit=dev`.
- **References**: https://github.com/advisories/GHSA-h25m-26qc-wcjf, https://github.com/advisories/GHSA-9g9p-9gw9-jx7f, https://github.com/advisories/GHSA-qx2v-qp2m-jg93.

---

## 7. Medium findings

### M-01 — `decrypt_pii` fails closed silently (returns NULL on missing vault key)

- **Severity**: Medium
- **Location**: migration 20260506175452 `decrypt_pii_fail_closed`; live function body confirms `RETURN NULL` on missing vault key path.
- **Vulnerability**: When the pgsodium / vault key is unavailable, `decrypt_pii` returns NULL. Callers (e.g. `get_decrypted_profile`, withdrawal admin views) get `email=NULL`. There is no exception, no log entry. A monitoring / alerting gap can hide a deployment misconfiguration where decryption is broken platform-wide.
- **Impact**: Operational. A misconfigured production cutover would silently disable email rendering in admin lists.
- **Recommendation**: On vault-key absence, `RAISE WARNING` (so it shows in pg logs) and bump a `payment_audit_log` event of category `decrypt_misconfig`. Keep returning NULL to avoid leaking ciphertext, but make the failure visible.
- **References**: CWE-755.

### M-02 — Email-confirmation status leak on login enables account enumeration

- **Severity**: Medium
- **Location**: `lib/auth.ts:140-152` — login handler returns "Please verify your email address before signing in" for unconfirmed accounts vs "Invalid email or password" for unknown accounts or wrong passwords.
- **Vulnerability**: An attacker submitting an email with a wrong password can distinguish three states: (1) account exists + email confirmed → "Invalid email or password", (2) account exists + email NOT confirmed → "Please verify your email", (3) account does not exist → "Invalid email or password". This collapses to a binary "exists+unconfirmed vs everything else" leak, useful for enumeration.
- **Recommendation**: Return identical "Invalid email or password" for unconfirmed accounts at the _login_ endpoint; show the "verify your email" hint only on the resend-confirmation endpoint after the user explicitly identifies themselves.
- **References**: CWE-204 (Observable Response Discrepancy), OWASP ASVS V3.2.

### M-03 — `admin/payments` route lacks rate limiter

- **Severity**: Medium
- **Location**: `app/api/admin/payments/route.ts:13` (GET) and `:63` (POST). No call to `adminLimiter` despite the helper being widely used in `app/api/admin/*`.
- **Vulnerability**: Defense-in-depth gap. A compromised admin token could enumerate or replay manual completions without rate-limit pressure.
- **Recommendation**: After the `check_is_admin` gate, call `adminLimiter.check(user.id)` and return `rateLimitResponse(retryAfterMs)` on 429.

### M-04 — `validate-referral-code` edge fn distinguishes existence

- **Severity**: Medium
- **Location**: `supabase/functions/validate-referral-code/index.ts:47-74`
- **Vulnerability**: Returns `{ valid: true }` for valid codes and `{ valid: false, error: "Invalid referral code" }` for unknown ones. Combined with `auto_generate_referral_code` granted to anon / PUBLIC (Phase B grant table), an attacker could brute-force the referral code namespace. Codes are short alphanumeric strings (per `generate_referral_code` body, not inspected this turn — verify §10 Q7).
- **Impact**: Referral code enumeration enables farming commissions by signing up under known codes, or social-engineering users into thinking a referral relationship exists.
- **Recommendation**: Either uniform error message AND a tight rate limit per-user, or rely on signup-time validation only.

### M-05 — `health` edge fn uses non-timing-safe secret comparison

- **Severity**: Medium
- **Location**: `supabase/functions/health/index.ts:31` — direct `!==` string compare. Contrast `view-scraper/index.ts:147-154` which uses `crypto.subtle.timingSafeEqual`.
- **Recommendation**: Replace with `crypto.subtle.timingSafeEqual` over `TextEncoder().encode()` of both strings.

### M-06 — `admin-notifications-send` accepts unvalidated `target_user_ids`

- **Severity**: Medium
- **Location**: `supabase/functions/admin-notifications-send/index.ts:154` — when `target_type='specific'`, `target_user_ids` is passed straight into `send_bulk_notifications` RPC.
- **Vulnerability**: Defense-in-depth: an admin (or anyone with admin compromise) can target arbitrary UUIDs, including non-existent or deleted users. RPC will silently no-op for non-existent IDs but the caller has no feedback.
- **Recommendation**: Pre-validate that each UUID exists in `profiles` before queueing; reject with detailed error if any don't.

### M-07 — KYC submit (`/api/kyc/submit`) writes no audit log entry

- **Severity**: Medium
- **Location**: `app/api/kyc/submit/route.ts` — no call to `logAdminAction` or audit_log insert (it's a user action, not admin, so neither table is appropriate; missing user-side audit).
- **Vulnerability**: No durable record of when a user submitted KYC, with which document type. Admin sees the result; forensics has no signal of submit-attempt fraud (rapid resubmissions, doc-type changes).
- **Recommendation**: Add a `kyc_audit_log` table (or extend `audit_log` to allow non-admin user_id) and write on every submit / cleanup event.

### M-08 — `admin/settings` GET allows any authenticated user to read platform settings

- **Severity**: Medium (Information Disclosure)
- **Location**: `app/api/admin/settings/route.ts:25-54` — only `verifyTokenAndGetUser`, no admin gate. Returns `min_withdrawal_gel`, `subscription_price_gel`, `featured_course_id`, `updated_at`, `updated_by`.
- **Vulnerability**: `updated_by` exposes admin user-ids to any authed student. Combined with `check_is_admin` being granted to anon (B-finding), allows enumeration of which users are admins.
- **Recommendation**: Restrict to admins, or strip `updated_by` and `updated_at` from the unauthenticated response (return only the public-relevant fields).

### M-09 — `keepz_payments.callback_payload` stored as plaintext jsonb including card-info fields

- **Severity**: Medium
- **Location**: `app/api/payments/keepz/callback/route.ts` writes the decrypted callback (which can contain card mask, card brand, card token, masked PAN) to the `callback_payload` column on the `keepz_payments` row.
- **Vulnerability**: At-rest encryption is provided by Supabase storage but the column itself is plaintext jsonb. Any DB compromise (e.g. via a leaked service-role key) yields card details for every successful payment. PCI-relevant context: even card masks + brand + last4 are PCI-DSS scope when combined with cardholder context.
- **Recommendation**: Filter the persisted payload to a minimal set (`status`, `keepz_order_id`, `paymentMethodType`, `amount`, `currency`, `paid_at`); strip any `cardInfo`/`cardMask`/`cardToken` before INSERT. Keep a hash if you need card-token correlation.

### M-10 — `chat-media/sign` and `dm/media-url` lack rate-limiter

- **Severity**: Medium (DoS / quota abuse)
- **Location**: `app/api/chat-media/sign/route.ts` and `app/api/dm/media-url/route.ts` — both authenticated and authorized but neither calls `generalLimiter`.
- **Vulnerability**: A user can spam signed-URL generation, consuming Supabase storage quota and producing log noise.
- **Recommendation**: Add `generalLimiter.check(user.id)` per route.

### M-11 — Realtime publication includes `coming_soon_emails` and `email_send_history`

- **Severity**: Medium (information disclosure to admins via subscriptions; verified low risk because RLS SELECT is admin-only on both)
- **Location**: pg_publication_tables membership confirmed live. `coming_soon_emails` and `email_send_history` SELECT policy is admin-only (verified §11).
- **Vulnerability**: Realtime broadcasts row-level events to subscribers that pass RLS. Today only admins receive these — but if the SELECT policy is later relaxed (e.g. for marketing dashboards), the realtime channel becomes a live PII firehose.
- **Recommendation**: Remove these tables from `supabase_realtime` publication (they're not subscribed to by client code; verify with `rg "channel.*coming_soon_emails\|channel.*email_send_history" components hooks`).

### M-12 — `profiles.signup_referral_code`, `referred_for_course_id`, `referral_code` user-mutable post-signup

- **Severity**: Medium
- **Location**: `protect_profiles_privileged_columns` body — none of these columns guarded.
- **Vulnerability**:
  - `signup_referral_code` and `referred_for_course_id` define the referral relationship recorded at signup. After signup, the user can self-rewrite these — but `process_referral` (verified body) only consults `referral_code` of the LOOKED-UP referrer, NOT `profiles.signup_referral_code`, so this is mostly cosmetic.
  - `referral_code` (the user's OWN sharable code): the `auto_generate_referral_code_trigger` fires only `WHEN (new.referral_code IS NULL)`. The user can therefore PATCH `profiles.referral_code` to any unused value (UNIQUE constraint is enforced) — claiming vanity codes. If a brand-aligned code (e.g. `ADMIN`, `FREE`, `STAFF`) is used in marketing, a user can pre-claim it.
- **Recommendation**: Block edits to `referral_code`, `signup_referral_code`, `referred_for_course_id` in `protect_profiles_privileged_columns`.

---

## 8. Low findings

- **L-01** — `middleware.ts:5` skips `/api/payments/keepz/callback` via `pathname.startsWith()`. Currently exact-only because no sub-paths exist, but a future `/api/payments/keepz/callback-v2` route would bypass middleware (CSP, no-store) silently. Use exact-match (`pathname === route`).
- **L-02** — `check_is_admin(user_id uuid)` granted to `anon` (verified). Anon can call `/rest/v1/rpc/check_is_admin?user_id=<uuid>` and receive `true`/`false`. UUIDs aren't enumerable but if any admin UUID leaks elsewhere (admin-rendered username on a course list, audit_log if exposed), this confirms admin status. Restrict to `authenticated` if no anon-side use.
- **L-03** — `auto_generate_referral_code` and `generate_referral_code` granted to anon/PUBLIC. Combined with M-04, allows anon enumeration. Restrict to `authenticated`.
- **L-04** — `app/api/kyc/cleanup/route.ts:47` calls `createServiceRoleClient(token)` passing the user token; reading `lib/supabase-server.ts:24-77` shows the fallback path is only triggered when `SUPABASE_SERVICE_ROLE_KEY` is unset (and throws in production). So in production the token argument is dead code. Cosmetic concern: the naming suggests user-token interplay with service-role; remove the argument to avoid future-developer footgun.
- **L-05** — `app/api/admin/withdrawals/[requestId]/approve/route.ts:54`, `:reject/route.ts:54` call `createServiceRoleClient(token)` with user token. Same as L-04 — dead code in production but misleading.
- **L-06** — `protect_profiles_kyc_status` checks `pg_trigger_depth() = 1` to allow nested-trigger updates (e.g. via `sync_profile_kyc_status` from `kyc_submissions`). This is correct but the condition is fragile: a future trigger introducing a deeper call chain could bypass. Add an explicit allowlist on `current_user IN ('postgres','service_role')` instead of a depth heuristic.
- **L-07** — `IBAN` regex `/^GE[0-9]{2}[A-Z]{2}[0-9]{16}$/` (in `app/api/balance/route.ts` and `withdrawals/route.ts`) validates length but not the ISO 13616 mod-97 checksum. Wrong-checksum IBANs are accepted; bank reconciliation will reject them later. UX, not security.
- **L-08** — Edge function `chat-pins/index.ts` has a `verify_jwt: false` config (per MCP listing); confirmed the function calls `getAuthenticatedUser` in its body, so this is fine — but a misclick on the dashboard could leave a future deployment exposed.
- **L-09** — `app/api/admin/payments/route.ts:31` (`statusFilter`) is passed unchanged to `.eq("status", statusFilter)`. Supabase parameterises this, but no allowlist check. If a future change concatenates the value, SQLi risk emerges.
- **L-10** — `app/api/admin/notifications/send/route.ts:50-58` sanitisation byte-cap is per-language (50KB each); two languages = 100KB total. Not a vulnerability — just inconsistent with the comment.
- **L-11** — `app/api/account/delete/route.ts` does not NULL `withdrawal_requests.user_id` even though it nulls `payment_audit_log.user_id` and `keepz_payments.user_id`. Orphan rows accumulate.
- **L-12** — Stale edge function deployments: MCP listing shows v1 entrypoints at `source/index.ts` (no `functions/<name>/` prefix) for `friend-requests`, `blocked-users` (and originally for some others). Local directories don't match these paths. Verified via `ls supabase/functions/` — no `friend-requests` or `blocked-users` directory exists locally. These are **stale deployments** still callable via HTTPS at `https://bvptqdmhuumjbyfnjxdt.supabase.co/functions/v1/friend-requests` and `/blocked-users`. Their behaviour is unknown (deployed before current source tree was committed). Re-verify their bodies via Supabase dashboard.
- **L-13** — `course-thumbnails` bucket is public (intentional for course catalog display). Verified.
- **L-14** — `avatars` bucket is public (intentional). Verified.

---

## 9. Informational / hardening

- **I-01** — All 65 SECURITY DEFINER public functions have `SET search_path` set explicitly (verified `proconfig` column). No drift.
- **I-02** — All public tables have RLS enabled (verified §11; zero rows in the `relrowsecurity=false` query).
- **I-03** — Storage buckets: `avatars`, `course-thumbnails` are public (intended). `chat-media`, `course-videos`, `dm-media`, `kyc-documents`, `payment-screenshots` all private with mime allowlists; SVG is rejected by allowlist (confirmed). Magic-byte sniff via `detectMime()` is performed by `chat-media` edge function (line 122-129).
- **I-04** — `complete_keepz_payment` correctly uses `FOR UPDATE` on the keepz_payments row before status transition.
- **I-05** — `process_referral` body verifies caller is the referred user (`p_referred_user_id != auth.uid()` raises) and prevents self-referral (`AND id != p_referred_user_id` in the referrer SELECT).
- **I-06** — `pay_submission` uses `FOR UPDATE` on both `submission_reviews` and `projects` rows; status-fences `v_review.status='accepted'` and `paid_at IS NULL`. Solid.
- **I-07** — `approve_withdrawal_request`, `reject_withdrawal_request`, `approve_kyc_submission`, `reject_kyc_submission` all use `FOR UPDATE` + `status='pending'` fences and verify admin via `check_is_admin(auth.uid())`.
- **I-08** — Edge function CORS uses an allowlist (`https://swavleba.ge`, `https://www.swavleba.ge`, `https://plankton-app-wpsym.ondigitalocean.app`, optional localhost). No wildcard.
- **I-09** — Rate limiter fail-closes when Upstash Redis is unreachable in production (`lib/rate-limit.ts:7-22, 67-75`).
- **I-10** — All admin-\* edge functions call `getAuthenticatedUser` followed by `checkIsAdmin` BEFORE any DB write (verified in deep-read).
- **I-11** — Plaintext PII columns NULL across staging: profiles_plaintext_email=0, \_full_name=0, \_bank=0; encrypted_email populated for all 3 staging profiles. Backfill complete.
- **I-12** — `handle_new_user` hardcodes `role := 'student'` and reads `wants_lecturer` boolean from `raw_user_meta_data` only to set `is_approved=false, lecturer_status='pending'` — no role escalation via signup payload.
- **I-13** — `validateRedirectUrl` (in `lib/validate-redirect.ts`) blocks `\\` (backslash open-redirect normalisation) and protocol-relative `//`; only allows relative paths starting with `/`. Used at all 4 OAuth/redirect entry points.
- **I-14** — `app/layout.tsx:130` and `:160` use `dangerouslySetInnerHTML` only for hardcoded scripts (theme bootstrap, Meta Pixel) with CSP nonce — verified static, no user input.
- **I-15** — No in-repo secrets found (regex sweep for `eyJ...` JWTs, `sk_(live|test)_*`, PEM headers across `app components lib supabase/functions hooks contexts`).
- **I-16** — Env vars used in code match `.env.example` exactly (zero diff in either direction).
- **I-17** — `keepz` callback handler enforces RSA-OAEP signature, optional IP allowlist, status-fence on FAILED callbacks (via `.in("status", ["created","pending","processing"])`), rate limit via `callbackLimiter`.
- **I-18** — `admin-notifications-send` sanitises HTML via `sanitize-html` with explicit tag allowlist BEFORE store (not just on render).

---

## 10. Things I could not verify (run these queries next)

| ID  | What                                                                                                   | Verification command                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | `protect_profiles_privileged_columns` body in PRODUCTION                                               | `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='protect_profiles_privileged_columns' AND pronamespace='public'::regnamespace;` (run on `nbecbsbuerdtakxkrduw`). Grep output for: `welcome_discount_expires_at`, `signup_referral_code`, `referred_for_course_id`, `referral_code`, `terms_accepted`, `marketing_emails_consent_at`, `email`, `full_name`, `encrypted_*`. Any missing → C-01 / M-12 still apply. |
| Q2  | Signup→delete loop welcome-discount refresh                                                            | In a test account: `INSERT INTO public.profiles (id,...) VALUES (...)` is blocked by `handle_new_user`; instead: sign up with email A, observe `welcome_discount_expires_at = NOW()+12h`; call `/api/account/delete`; sign up again with same email A; observe new row has fresh `welcome_discount_expires_at`.                                                                                                             |
| Q3  | Keepz token-reuse semantics                                                                            | Ask Keepz support: "If user A and user B both save the same physical card on different orders, do they receive the same `cardToken` value?" If yes, H-01 is exploitable today; if no, H-01 is hardening only.                                                                                                                                                                                                               |
| Q4  | `approve_project_subscription` re-approve test                                                         | On staging: create a project_subscription with `status='active'`; call RPC again; observe whether `expires_at` is extended by another month (it will be — `WHERE id = subscription_id` only).                                                                                                                                                                                                                               |
| Q5  | Orphan keepz_payments in production                                                                    | `SELECT id, user_id, payment_type, reference_id FROM keepz_payments WHERE status='success' AND payment_type='course_enrollment' AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.user_id=keepz_payments.user_id AND e.course_id=(SELECT course_id FROM enrollment_requests WHERE id=keepz_payments.reference_id));`                                                                                                      |
| Q6  | Concurrent enrollment-approve race window                                                              | Spawn two parallel calls to `approve_enrollment_request(<same-id>)` in a SQL session; check `balance_transactions` count for that `reference_id` and `source='course_purchase'`. Expect 1; observe 2 if race fires.                                                                                                                                                                                                         |
| Q7  | Referral code namespace size                                                                           | `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='generate_referral_code';` Read alphabet + length. Compute namespace size. Compare to current `count(*) FROM profiles WHERE referral_code IS NOT NULL`. Estimate brute-force feasibility for M-04.                                                                                                                                                               |
| Q8  | Stale edge functions `friend-requests`, `blocked-users`                                                | In Supabase dashboard, click each function's source view. If the source predates current branch (e.g. shows old DM logic), redeploy with current source or delete the function entirely.                                                                                                                                                                                                                                    |
| Q9  | `create_kyc_submission` accepts `path` regex including `..` via Unicode normalisation                  | The regex `^<uuid>/[A-Za-z0-9_-]+/front\.[a-z0-9]+$` does not allow `.` in the middle segment, but does allow it at the file-extension boundary. Verify Supabase storage rejects unicode-tricks (zero-width joiners, NFC collisions) consistent with the regex. Test with `--data-binary` upload of a path containing `​`.                                                                                                  |
| Q10 | Whether `course_videos` bucket policy allows ENROLLED users to read videos for FREE-via-bundle courses | Bundle enrollments set up `enrollments` rows for each bundle item. Policy is "enrolled OR lecturer OR admin" (verified). Should work. Spot-check by creating a bundle, paying via test card, listing videos.                                                                                                                                                                                                                |

---

## 11. Coverage matrices

### 11.1 — API route coverage (selected; full inventory in repo)

| Route                                 | Methods     | Auth                                       | Authz                         | Validation                             | Rate-limit                      | Audit                      |
| ------------------------------------- | ----------- | ------------------------------------------ | ----------------------------- | -------------------------------------- | ------------------------------- | -------------------------- |
| `/api/payments/keepz/callback`        | POST        | RSA-encrypted payload (middleware-skipped) | n/a                           | hand-rolled (status-fence, amount eq.) | callbackLimiter                 | payment_audit_log          |
| `/api/payments/keepz/create-order`    | POST        | Bearer                                     | own user                      | zod                                    | paymentLimiter                  | log_payment_event          |
| `/api/payments/keepz/status`          | GET         | Bearer                                     | own user                      | UUID                                   | generalLimiter                  | payment_audit_log          |
| `/api/payments/keepz/verify-pending`  | GET         | Bearer                                     | own user                      | none                                   | paymentLimiter                  | payment_audit_log          |
| `/api/payments/saved-cards`           | GET, DELETE | Bearer                                     | own user                      | UUID                                   | accountLimiter                  | none                       |
| `/api/balance`                        | GET, PATCH  | Bearer                                     | own user (RLS)                | IBAN regex (PATCH)                     | accountLimiter                  | none                       |
| `/api/withdrawals`                    | GET, POST   | Bearer                                     | own user                      | RPC-internal                           | generalLimiter / paymentLimiter | RPC-internal               |
| `/api/admin/withdrawals`              | GET         | Bearer + admin RPC                         | admin                         | status whitelist                       | adminLimiter                    | logAdminAction             |
| `/api/admin/withdrawals/[id]/approve` | POST        | Bearer + admin RPC                         | admin                         | UUID                                   | adminLimiter                    | logAdminAction             |
| `/api/admin/withdrawals/[id]/reject`  | POST        | Bearer + admin RPC                         | admin                         | UUID                                   | adminLimiter                    | logAdminAction             |
| `/api/admin/payments`                 | GET, POST   | Bearer + admin RPC                         | admin                         | UUID                                   | **none ⚠ (M-03)**               | logAdminAction             |
| `/api/kyc/submit`                     | POST        | Bearer                                     | own user                      | regex paths                            | paymentLimiter                  | **none ⚠ (M-07)**          |
| `/api/kyc/status`                     | GET         | Bearer                                     | own user                      | none                                   | generalLimiter                  | none                       |
| `/api/kyc/cleanup`                    | POST        | Bearer                                     | own user                      | regex                                  | generalLimiter                  | none                       |
| `/api/admin/kyc`                      | GET         | Bearer + admin RPC                         | admin                         | status whitelist                       | adminLimiter                    | logAdminAction             |
| `/api/admin/kyc/[id]/signed-urls`     | GET         | Bearer + admin RPC                         | admin                         | UUID                                   | adminLimiter                    | logAdminAction             |
| `/api/admin/kyc/[id]/approve`         | POST        | Bearer + admin RPC                         | admin                         | UUID                                   | adminLimiter                    | logAdminAction             |
| `/api/admin/kyc/[id]/reject`          | POST        | Bearer + admin RPC                         | admin                         | UUID                                   | adminLimiter                    | logAdminAction             |
| `/api/profile`                        | GET, PATCH  | Bearer                                     | own user                      | regex (PATCH)                          | accountLimiter                  | none                       |
| `/api/complete-profile`               | POST        | Bearer                                     | own user                      | zod                                    | accountLimiter                  | none                       |
| `/api/account/delete`                 | DELETE      | Bearer + password re-auth                  | own user                      | length                                 | accountLimiter                  | audit_log (self-tombstone) |
| `/api/admin/settings`                 | GET         | Bearer **(no admin gate ⚠ M-08)**          | any authed                    | none                                   | none                            | none                       |
| `/api/admin/settings`                 | PUT         | Bearer + admin RPC                         | admin                         | numeric                                | adminLimiter                    | **none ⚠**                 |
| `/api/admin/notifications/send`       | POST        | Bearer + admin RPC                         | admin                         | extensive zod-equiv                    | adminLimiter                    | logAdminAction             |
| `/api/chat-media/sign`                | GET         | Bearer                                     | enrollment / lecturer / admin | UUID + path normalize                  | **none ⚠ (M-10)**               | none                       |
| `/api/dm/media-url`                   | GET         | Bearer                                     | conversation participant      | UUID + path normalize                  | **none ⚠ (M-10)**               | none                       |
| `/api/health`                         | GET         | secret header (timing-unsafe)              | secret                        | none                                   | none                            | none                       |
| `/api/public/validate-referral-code`  | POST        | public                                     | n/a                           | string                                 | referralLimiter                 | none                       |
| `/api/public/coming-soon`             | POST        | public                                     | n/a                           | email regex                            | subscribeLimiter                | none                       |

### 11.2 — Edge function coverage (active list from MCP, 39 functions)

All edge functions are deployed with `verify_jwt: false`; each implements its own `getAuthenticatedUser` first-call where applicable. Library imports pinned via `import_map.json` to `@supabase/supabase-js@2.98.0` and `resend@2.1.0`. CORS allowlist via `_shared/cors.ts`.

| Function                                                                             | First call                                 | Admin gate               | Rate limit | Notes                       |
| ------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------------ | ---------- | --------------------------- |
| admin-withdrawal-approve                                                             | getAuthenticatedUser                       | checkIsAdmin             | none       | OK                          |
| admin-withdrawal-reject                                                              | getAuthenticatedUser                       | checkIsAdmin             | none       | OK                          |
| admin-withdrawals                                                                    | getAuthenticatedUser                       | checkIsAdmin             | none       | OK                          |
| admin-enrollment-approve                                                             | getAuthenticatedUser                       | checkIsAdmin             | none       | RPC race H-04               |
| admin-enrollment-reject                                                              | getAuthenticatedUser                       | checkIsAdmin             | none       | RPC race H-04               |
| admin-enrollment-requests                                                            | getAuthenticatedUser                       | checkIsAdmin             | none       | OK                          |
| admin-bundle-enrollment-approve                                                      | getAuthenticatedUser                       | checkIsAdmin             | none       | H-02                        |
| admin-bundle-enrollment-reject                                                       | getAuthenticatedUser                       | checkIsAdmin             | none       | OK                          |
| admin-bundle-enrollment-requests                                                     | getAuthenticatedUser                       | checkIsAdmin             | none       | OK                          |
| admin-notifications-send                                                             | getAuthenticatedUser                       | checkIsAdmin             | none       | M-06                        |
| balance                                                                              | getAuthenticatedUser                       | n/a                      | none       | OK                          |
| withdrawals                                                                          | getAuthenticatedUser                       | n/a                      | none       | OK                          |
| chat-media                                                                           | getAuthenticatedUser                       | enrollment + admin paths | none       | Magic-byte sniff ✅         |
| chat-messages                                                                        | getAuthenticatedUser                       | enrollment + admin paths | none       | Reaction allowlist ✅       |
| chat-mute, chat-pins, chat-typing, chat-unread                                       | getAuthenticatedUser                       | n/a                      | none       | OK                          |
| course-chats                                                                         | getAuthenticatedUser                       | enrollment               | none       | OK                          |
| dm-media                                                                             | getAuthenticatedUser                       | participant check        | none       | 15min URL TTL               |
| dm-messages                                                                          | getAuthenticatedUser                       | participant check        | none       | OK                          |
| dm-channels, dm-conversations, dm-unread                                             | getAuthenticatedUser                       | participant check        | none       | dm-channels v1 stale (L-12) |
| friend-requests (v1, stale)                                                          | unknown                                    | unknown                  | unknown    | **L-12 — investigate**      |
| friends                                                                              | getAuthenticatedUser                       | n/a                      | none       | OK                          |
| blocked-users (v1, stale)                                                            | unknown                                    | unknown                  | unknown    | **L-12 — investigate**      |
| me-enrollments                                                                       | getAuthenticatedUser                       | n/a                      | none       | OK                          |
| notifications, notification-read, notifications-read-all, notifications-unread-count | getAuthenticatedUser                       | n/a                      | none       | OK                          |
| enrollment-requests, bundle-enrollment-requests                                      | getAuthenticatedUser                       | n/a                      | none       | OK                          |
| validate-referral-code                                                               | getAuthenticatedUser                       | n/a                      | none       | M-04                        |
| view-scraper                                                                         | dual: secret OR getAuthenticatedUser+admin | admin                    | none       | timing-safe ✅              |
| health                                                                               | secret only                                | n/a                      | none       | M-05 (timing-unsafe)        |

### 11.3 — Sensitive-table RLS coverage

| Table                                                                                      | RLS | SELECT scope           | INSERT scope                  | UPDATE scope                                      | In realtime? | Protect-trigger coverage |
| ------------------------------------------------------------------------------------------ | --- | ---------------------- | ----------------------------- | ------------------------------------------------- | ------------ | ------------------------ |
| profiles                                                                                   | ✅  | own + admin            | self                          | own (no WITH CHECK)                               | ✅           | partial — see C-01, M-12 |
| keepz_payments                                                                             | ✅  | own                    | self                          | service-role only                                 | ✅           | n/a (no user UPDATE)     |
| balance_transactions                                                                       | ✅  | own + admin            | service-role only             | n/a                                               | ✅           | n/a                      |
| withdrawal_requests                                                                        | ✅  | own + admin            | self                          | admin only                                        | ✅           | encrypt trigger ✅       |
| saved_cards                                                                                | ✅  | own                    | service-role                  | own (soft-delete)                                 | (not in pub) | n/a                      |
| kyc_submissions                                                                            | ✅  | own + admin            | self                          | admin only                                        | ✅           | sync trigger to profiles |
| referrals                                                                                  | ✅  | own + admin            | denied (`with_check=false`)   | service-role                                      | ✅           | n/a                      |
| email_send_history                                                                         | ✅  | admin only             | service-role                  | service-role                                      | ✅           | n/a                      |
| coming_soon_emails                                                                         | ✅  | admin only             | (mig 237 dropped anon insert) | service-role                                      | ✅           | n/a                      |
| audit_log, payment_audit_log                                                               | ✅  | admin only             | service-role                  | n/a                                               | n/a          | n/a                      |
| platform_settings                                                                          | ✅  | authed read (M-08)     | service-role                  | admin                                             | ✅           | n/a                      |
| courses, course_bundles, channels, videos                                                  | ✅  | varies                 | lecturer/admin                | lecturer/admin (no WITH CHECK; USING fallback OK) | ✅           | n/a                      |
| enrollments, enrollment_requests, bundle_enrollment_requests, bundle_enrollments           | ✅  | own + lecturer + admin | RPC                           | admin RPC                                         | ✅           | n/a                      |
| project_subscriptions, projects, project_submissions, project_criteria, submission_reviews | ✅  | own + lecturer + admin | varies                        | admin / lecturer                                  | ✅           | n/a                      |
| messages, message_attachments, message_reactions, chat_pinned_messages                     | ✅  | enrolled               | enrolled                      | own                                               | ✅           | n/a                      |
| dm_messages, dm_message_attachments, dm_unread_messages                                    | ✅  | participant            | participant                   | own                                               | ✅           | n/a                      |
| dm_conversations, dm_participants                                                          | ✅  | participant            | RPC-only                      | n/a                                               | (partial)    | n/a                      |
| friend_requests, friendships                                                               | ✅  | involved               | RPC                           | own                                               | ✅           | n/a                      |
| typing_indicators, unread_messages, muted_users                                            | ✅  | enrolled               | own                           | own                                               | ✅           | n/a                      |
| view_scrape_runs, view_scrape_results                                                      | ✅  | admin                  | admin                         | admin                                             | ✅           | n/a                      |

---

## 12. Vulnerability summary table

| #      | Severity    | Category          | Location                                                              | Vulnerability                                                  | Exploit                                      | Fix                                                     |
| ------ | ----------- | ----------------- | --------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------- |
| 1      | Critical    | Authz             | `protect_profiles_privileged_columns`                                 | `welcome_discount_expires_at` not protected                    | PATCH /rest/v1/profiles → permanent discount | Extend trigger column list                              |
| 2      | Latent Crit | Lifecycle         | `handle_new_user` + `account/delete`                                  | Signup loop refreshes welcome + 1mo project access             | Self-loop                                    | Per-email tombstone, decouple from signup trigger       |
| 3      | High        | Data integrity    | `saved_cards.idx_saved_cards_token`                                   | UNIQUE on token-only; cross-user clobber on upsert             | If Keepz reuses tokens for same card         | Composite UNIQUE (user_id, card_token)                  |
| 4      | High        | TOCTOU            | `approve_project_subscription`, `approve_bundle_enrollment_request`   | No status fence; re-approve loop                               | Compromised admin                            | Add `AND status='pending'` to UPDATE                    |
| 5      | High        | Atomicity         | `complete_keepz_payment` outer EXCEPTION                              | Status flips to success, then enrollment/credit fails silently | Transient DB error                           | Move status flip inside BEGIN block; reconciliation job |
| 6      | High        | TOCTOU            | `approve_enrollment_request`, `reject_enrollment_request`             | No FOR UPDATE; UPDATE without status fence                     | Concurrent admin                             | Add `FOR UPDATE` + status fence                         |
| 7      | High        | Dependency        | `package.json next@14.2.35`                                           | DoS CVE GHSA-h25m-26qc-wcjf                                    | Single attacker                              | Upgrade next                                            |
| 8      | Medium      | Logging           | `decrypt_pii`                                                         | Returns NULL silently when vault key missing                   | Operational                                  | RAISE WARNING + audit-log event                         |
| 9      | Medium      | Enumeration       | `lib/auth.ts` login                                                   | Distinguishes unconfirmed vs unknown                           | Anon                                         | Uniform error                                           |
| 10     | Medium      | Defense-in-depth  | `app/api/admin/payments`                                              | No rate limiter                                                | Compromised admin token                      | Add adminLimiter                                        |
| 11     | Medium      | Enumeration       | `validate-referral-code` edge fn                                      | Existence leak                                                 | Authed                                       | Uniform error or tight per-user limit                   |
| 12     | Medium      | Crypto            | `health` edge fn                                                      | Timing-unsafe secret compare                                   | Network attacker                             | timingSafeEqual                                         |
| 13     | Medium      | Defense-in-depth  | `admin-notifications-send:154`                                        | target_user_ids not pre-validated                              | Compromised admin                            | Pre-validate UUIDs                                      |
| 14     | Medium      | Forensics         | `app/api/kyc/submit`                                                  | No audit log                                                   | n/a                                          | Add user-side audit table                               |
| 15     | Medium      | Info disclosure   | `app/api/admin/settings` GET                                          | No admin gate; leaks `updated_by`                              | Authed                                       | Restrict to admin or strip fields                       |
| 16     | Medium      | Data-at-rest      | `keepz_payments.callback_payload`                                     | Plaintext jsonb with card mask/brand                           | DB compromise                                | Filter persisted payload                                |
| 17     | Medium      | DoS               | `chat-media/sign`, `dm/media-url`                                     | No rate limiter                                                | Authed                                       | Add generalLimiter                                      |
| 18     | Medium      | Realtime          | `coming_soon_emails`, `email_send_history`                            | In publication; future RLS relaxation = leak                   | Latent                                       | Remove from publication                                 |
| 19     | Medium      | Authz             | `protect_profiles_privileged_columns`                                 | Several columns user-mutable                                   | PATCH                                        | Extend trigger                                          |
| 20     | Low         | Defense-in-depth  | `middleware.ts:5`                                                     | startsWith skip path                                           | Future routes                                | Exact match                                             |
| 21     | Low         | Enumeration       | `check_is_admin` granted to anon                                      | Admin enumeration via uuid                                     | Anon                                         | authenticated-only                                      |
| 22     | Low         | Enumeration       | `auto_generate_referral_code` granted to PUBLIC                       | n/a                                                            | Anon                                         | authenticated-only                                      |
| 23     | Low         | Cosmetic          | `kyc/cleanup`, `admin/withdrawals/*` `createServiceRoleClient(token)` | Dead code in prod                                              | n/a                                          | Drop arg                                                |
| 24     | Low         | Trigger fragility | `protect_profiles_kyc_status`                                         | depth heuristic                                                | Future trigger                               | Allowlist current_user                                  |
| 25     | Low         | UX                | IBAN regex                                                            | No mod-97 checksum                                             | n/a                                          | mod-97 validate                                         |
| 26     | Low         | Audit             | Future                                                                | `verify_jwt:false` per-fn                                      | Misclick on dashboard                        | Codify in config.toml                                   |
| 27     | Low         | Defense-in-depth  | `app/api/admin/payments` GET                                          | statusFilter unallowlisted                                     | Future SQL change                            | Allowlist                                               |
| 28     | Low         | Cosmetic          | sanitize-html 50KB                                                    | per-language not total                                         | n/a                                          | Update comment or limit                                 |
| 29     | Low         | Forensics         | account/delete                                                        | Doesn't NULL withdrawal_requests.user_id                       | n/a                                          | Extend anonymisation                                    |
| 30     | Low         | Stale deploy      | `friend-requests` v1, `blocked-users` v1 edge fns                     | Unknown source                                                 | Anon (depending on body)                     | Investigate / delete                                    |
| 31     | Low         | Bucket            | `course-thumbnails`, `avatars` public                                 | Intentional                                                    | n/a                                          | n/a                                                     |
| Q1-Q10 | n/a         | Could not verify  | see §10                                                               | various                                                        | various                                      | run queries                                             |

---

## Appendix A — Supabase advisor summary

**Performance advisor** (251 findings): all WARN/INFO, no ERROR.

- 198 × `multiple_permissive_policies` — multiple SELECT policies per role causing sequential evaluation (top affected: `messages`, `message_attachments`, `project_submissions`, `notifications`, `submission_reviews`).
- 51 × `unused_index` — top: `courses_bestseller_idx`, `messages_channel_id_idx`, `messages_created_at_idx`.
- 1 × `duplicate_index`.
- 1 × `auth_db_connections_absolute` (INFO) — auth pool fixed at 10 connections.

**Security advisor** (raw output 218 KB; selected highlights from preview):

- `anon_security_definer_function_executable` — WARN — affects: `check_is_admin(user_id uuid)`, `has_project_access(uid uuid)`, `auto_generate_referral_code()`, `generate_referral_code()`, `check_username_unique()`, `handle_updated_at()` (latter four are by-design public). For the first two, see L-02.

(Full advisor output saved at `/Users/bezhomatiashvili/.claude/projects/-Users-bezhomatiashvili-Desktop-MainCourse/72ddb961-0349-4644-bcbc-1888c6285ad5/tool-results/mcp-supabase-get_advisors-1778136182116.txt`. Run remediation per https://supabase.com/docs/guides/database/database-linter.)

---

## Appendix B — `npm audit --omit=dev`

```
Total vulns: 4
By severity: { info: 0, low: 0, moderate: 1, high: 1, critical: 0, total: 2 }
Affected packages: 2

next  (high)
  GHSA-9g9p-9gw9-jx7f  (moderate, CVSS 5.9)  — Image Optimizer DoS
                            range: >=10.0.0 <15.5.10
  GHSA-h25m-26qc-wcjf  (high, CVSS 7.5)      — RSC HTTP request deserialization DoS
                            range: >=13.0.0 <15.0.8
postcss (moderate)
  GHSA-qx2v-qp2m-jg93  (moderate, CVSS 6.1)  — XSS via unescaped </style>
                            range: <8.5.10
```

---

## Appendix C — What's solid (don't break in future refactors)

- **`handle_new_user` is correct.** Hardcodes role=student. Reads only `wants_lecturer` and `wants_marketing` booleans from raw_user_meta_data. Auto-username for OAuth. Username uniqueness check + format regex. Two-branch (email vs OAuth) explicit. Reference: live `pg_get_functiondef`. **CLAUDE.md regression-flag is current.**
- **Keepz callback signature + IP allowlist + status fence + amount equality + idempotency are all in place.** The handler is paranoid in the right way — preserve this discipline.
- **All SECURITY DEFINER public functions have `SET search_path = public, pg_temp` (or `+extensions`/`+cron` where needed).** Don't drop this.
- **PII encryption migrated and backfill complete** (0 plaintext rows across email/full_name/bank). Don't insert plaintext into legacy columns.
- **`approve_withdrawal_request`, `reject_withdrawal_request`, `approve_kyc_submission`, `reject_kyc_submission`, `pay_submission` use `FOR UPDATE` + status fences correctly.** Use them as templates for future approval RPCs.
- **`process_referral` blocks self-referral and uses `ON CONFLICT (referred_user_id, enrollment_request_id) DO NOTHING`.**
- **CORS allowlist (no wildcard).** Adding new origins requires editing `_shared/cors.ts`; resist the temptation to add `*` even temporarily.
- **Rate limiter fail-closed in production.** Don't change the fallback to fail-open.
- **`validateRedirectUrl` is solid** (rejects `\\`, protocol-relative `//`, anything not starting with `/`). Use it for every new redirect param.
- **Storage bucket privatisation is current.** Don't make `chat-media`, `course-videos`, `dm-media`, `kyc-documents`, `payment-screenshots` public again.
- **Edge function admin-\* always check admin BEFORE writes.** Use them as templates.
- **`admin/notifications/send` HTML sanitisation on STORE (not render) is correct.** Don't move it to render-time.

---

_End of report. Report path:_ `docs/security-audit-2026-05-07.md`
