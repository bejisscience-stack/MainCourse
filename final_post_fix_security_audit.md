# Final Post-Fix Security Audit

## Audit context

- **Branch**: `deps/security-fixes-staging`
- **Commit**: `21a6eac0cdf29d9193aeecf5213dd9c12d4c531e` (working tree clean)
- **Date**: 2026-05-07
- **Staging DB inspected**: Yes — Supabase project `bvptqdmhuumjbyfnjxdt`, read-only via the Supabase MCP tools (`SELECT`, `pg_get_functiondef`, `pg_policies`, `pg_indexes`, `pg_publication_tables`, `pg_trigger`, `information_schema.routine_privileges`, `information_schema.column_privileges`, `supabase_migrations.schema_migrations`). No DML/DDL was issued; no `apply_migration`.
- **Production DB**: NOT touched. Project `nbecbsbuerdtakxkrduw` was excluded from every tool call.
- **Baseline**: this audit re-verifies the 26 findings from `codex_claude_security_review.md` (against commit `92d1362`) and runs an independent fresh attack-surface review against current HEAD. Two follow-up commits closed many of the prior gaps: `6cd7ac9` (atomic admin approvals) and `21a6eac` (broad follow-ups: profile column protection, withdrawal IBAN guard, atomic Keepz callback, anon grant revokes, dropping email from `get_safe_profiles`, admin users-with-emails route, video URL parser hardening, login error unification, etc.).

## Executive summary

The previous round of fixes substantially improved the security posture. Of the 26 prior findings, **17 are verified fixed at both code and staging-runtime levels**, **5 are partially fixed** (residual hygiene/enumeration risks), and **4 remain unfixed**. There are no validated new vulnerabilities introduced by the fixes, but seven new/residual findings warrant attention — chiefly the **signup-delete-resignup welcome-discount + free-month-of-project-access loop** (A-2), which is genuinely exploitable by an authenticated user willing to recreate their account.

Overall: the codebase is materially safer than the codex baseline. The blocking issue for ship is the resignup loop (`F-001`); everything else is Low/Medium hygiene that does not endanger payment integrity, role/admin escalation, or PII at rest.

## Previous fix verification matrix

| ID   | Area                                                   | Status                           | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | ------------------------------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-1  | `welcome_discount_expires_at` direct mutation          | **Verified fixed**               | Staging `pg_get_functiondef('protect_profiles_privileged_columns')` confirms the column-by-column blocklist explicitly raises `42501` for `welcome_discount_expires_at` when `current_user IN ('authenticated','anon')`. Trigger `protect_profiles_privileged_columns` is enabled (`tgenabled='O'`) on `public.profiles`.                                                                                                                                                                                                                                                                                |
| A-2  | Signup-delete-resignup welcome/free-access abuse       | **Not fixed**                    | Staging `handle_new_user` body unconditionally sets `welcome_discount_expires_at = NOW() + INTERVAL '12 hours'` and `project_access_expires_at = NOW() + INTERVAL '1 month'` for every new auth user, regardless of historical email. `app/api/account/delete/route.ts:79-130` anonymizes `payment_audit_log` and `keepz_payments` and inserts an `audit_log` row, then calls `serviceSupabase.auth.admin.deleteUser(user.id)` at line 132 — no email tombstone, no `handle_new_user` first-ever-email gate. See `F-001`.                                                                                |
| A-3  | `get_safe_profiles` decrypted-email leak               | **Verified fixed**               | Staging `pg_get_functiondef('get_safe_profiles')` returns only `(id, username, avatar_url, role)` — no email column. Admin replacement route `app/api/admin/users-with-emails/route.ts:21-73` is `verifyAdminRequest`-gated and uses service-role `get_decrypted_profiles` which is _not_ granted to anon/authenticated (confirmed via `information_schema.routine_privileges`).                                                                                                                                                                                                                         |
| A-4  | Next.js version on vulnerable line                     | **Not fixed**                    | `package.json:38` still pins `"next": "^14.2.35"`. Caret-resolution stays on the 14.x line. See `F-005`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| A-5  | `complete_keepz_payment` success-before-business-logic | **Verified fixed**               | Staging RPC body now wraps the status update + business effects in a single `BEGIN ... EXCEPTION WHEN OTHERS THEN ... payment_recorded=false ... RETURN ... END` block (mig 244). On exception, both status and balance side-effects roll back together. Pre-existing-success branch only triggers reconciliation crediting when `balance_transactions` is empty for the reference (true idempotency).                                                                                                                                                                                                   |
| A-6  | Project subscription / bundle approval races           | **Verified fixed**               | Staging `approve_project_subscription` and `approve_bundle_enrollment_request` (both 1-arg and 2-arg overloads) now use `SELECT ... FOR UPDATE`, `UPDATE ... WHERE id=$ AND status='pending'`, and `GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count = 0 THEN RAISE EXCEPTION 'already processed'`. Mig 242 + commit `6cd7ac9` log claims empirical race testing.                                                                                                                                                                                                                                         |
| A-7  | Enrollment approve/reject TOCTOU                       | **Verified fixed**               | Staging `approve_enrollment_request` and `reject_enrollment_request` use the same `FOR UPDATE` + status-fenced UPDATE + `GET DIAGNOSTICS` pattern.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| A-8  | Other privileged profile columns                       | **Verified fixed**               | Staging `protect_profiles_privileged_columns` blocks: `balance, is_approved, lecturer_status, project_access_expires_at, can_create_free_projects, profile_completed, welcome_discount_expires_at, referral_code, signup_referral_code, referred_for_course_id, email, full_name, bank_account_number, encrypted_email, encrypted_full_name, encrypted_bank_account_number`. Two further dedicated triggers cover the highest-risk columns: `protect_profiles_role` (rejects when `current_user IN ('authenticated','anon')`) and `protect_profiles_kyc_status` (rejects when `pg_trigger_depth() = 1`). |
| A-9  | Broad `submission_reviews` SELECT policy               | **Verified fixed**               | Staging `pg_policies` for `submission_reviews` shows the broad `"Authenticated users can view submission reviews"` policy is gone. Replacement: `"Users can view reviews in enrolled courses"` joins through `project_submissions → projects → enrollments` and requires `e.user_id = auth.uid() AND e.course_id = p.course_id` (or course lecturer ownership). Lecturers' INSERT/UPDATE policies require both `lecturer_id = auth.uid()` and project-via-course ownership. Admin policies are separate.                                                                                                 |
| A-10 | `process_signup_referral_on_enrollment` IDOR           | **Verified fixed**               | Staging RPC body has `IF auth.uid() IS NULL OR p_user_id <> auth.uid() THEN RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501'`. Grants: only `authenticated` execute.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| A-11 | Manual bundle approval double-credit                   | **Verified fixed**               | Staging `approve_bundle_enrollment_request(uuid)` now wraps the credit + enrollment + notification in `IF NOT v_already_credited` where `v_already_credited` is computed from `EXISTS(SELECT 1 FROM balance_transactions WHERE reference_id = request_id AND source = 'course_purchase')`. Combined with the status fence, repeat manual approval cannot double-credit.                                                                                                                                                                                                                                  |
| A-12 | Video URL hostname allowlist                           | **Verified fixed**               | `lib/video-url-parser.ts:9-11` and `supabase/functions/view-scraper/index.ts:13-15` both define `hostnameMatches(hostname, allowed)` as `hostname === allowed \|\| hostname.endsWith("." + allowed)`. `tiktok.com.evil.com` no longer matches `tiktok.com`.                                                                                                                                                                                                                                                                                                                                              |
| A-13 | Admin notification consent bypass                      | **Partially fixed**              | `app/api/admin/notifications/send/route.ts:547-584` adds a `TRANSACTIONAL_BULK_DAILY_CAP = 1000` per admin per 24h for `target_type='all' && override_consent && email_target ∈ {profiles, both}`, with fail-closed behaviour if the count query errors. The body-supplied `category` is still trusted (line 350-355) and still drives `effectiveRespectConsent = false` for transactional categories. The cap throttles abuse but doesn't bind transactional categories to approved templates/events. See `F-007`.                                                                                      |
| A-14 | Login account enumeration                              | **Verified fixed (signin only)** | `lib/auth.ts:144-152` collapses `Email not confirmed` and `Invalid login credentials` into one generic message. **However**, the signup path at `lib/auth.ts:78-99` still distinguishes existing-confirmed (`"already registered"` from Supabase) and existing-unconfirmed (empty `data.user.identities`) accounts, both throwing a distinct `"An account with this email already exists"` error. See `F-010`.                                                                                                                                                                                           |
| A-15 | Keepz callback payload card data                       | **Verified fixed**               | TS-side: `lib/keepz.ts:442-467` defines a strict allowlist `KEEPZ_PAYLOAD_KEEP_KEYS` and replaces `cardInfo.token` with SHA-256. `app/api/payments/keepz/callback/route.ts:253-259` passes `redactKeepzPayload(callbackData)` to the RPC; the failed-callback branch at `:362` also redacts before persisting. SQL-side: `_keepz_redact_callback(jsonb)` (mig 244) returns `jsonb_strip_nulls(jsonb_build_object(...))` over the same allowlist and is invoked inside `complete_keepz_payment` before `UPDATE keepz_payments SET callback_payload = ...`. Defense in depth at both layers.               |
| A-16 | Saved-card unique index not user-scoped                | **Verified fixed**               | Staging `pg_indexes` on `saved_cards` shows `CREATE UNIQUE INDEX idx_saved_cards_user_token ON public.saved_cards USING btree (user_id, card_token)`. `app/api/payments/keepz/callback/route.ts:341` uses `onConflict: "user_id,card_token"`.                                                                                                                                                                                                                                                                                                                                                            |
| A-17 | Migration prefix collisions                            | **Partially fixed**              | 11 historical numeric-prefix collisions remain in `supabase/migrations/`. New work uses timestamp prefixes (correct), and migration `20260507151755_collided_prefixes_reassert.sql` was added to re-assert critical state idempotently. Latent ordering risk for fresh-environment resets remains.                                                                                                                                                                                                                                                                                                       |
| A-18 | Signed-URL routes lack rate limits                     | **Verified fixed**               | `app/api/chat-media/sign/route.ts:51-53` and `app/api/dm/media-url/route.ts:48-50` both call `notificationLimiter.check(user.id)` (60/60s) after auth and before `createSignedUrl`.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| A-19 | `complete-profile` service-role blast radius           | **Verified fixed**               | `app/api/complete-profile/route.ts:46-58` now creates a _user-token_ `createServerSupabaseClient(token)` and calls SECURITY DEFINER RPC `complete_own_profile(p_username, p_role, p_marketing_emails_consent)`. Staging RPC body whitelists exactly: `username, profile_completed=TRUE, terms_accepted, terms_accepted_at, marketing_emails_consent, marketing_emails_consent_at, lecturer_status, is_approved` and short-circuits if `profile_completed` is already TRUE. No service-role surface on this route.                                                                                        |
| A-20 | Withdrawal RPC lacks IBAN validation                   | **Verified fixed**               | Staging `create_withdrawal_request` body has `IF coalesce(p_bank_account_number,'') !~ '^GE[0-9]{2}[A-Z]{2}[0-9]{16}$' THEN RAISE EXCEPTION 'Invalid Georgian IBAN format' USING ERRCODE = '22023'`. API-level regex still present at `app/api/withdrawals/route.ts:108`.                                                                                                                                                                                                                                                                                                                                |
| A-21 | Admin payments limiter / settings metadata leak        | **Verified fixed**               | `app/api/admin/payments/route.ts:25-37` adds `check_is_admin` + `adminLimiter.check(user.id)` for both GET and POST. `app/api/admin/settings/route.ts:42-48` runs `check_is_admin` and selects `updated_at, updated_by` only for admins; non-admins get the public fields only.                                                                                                                                                                                                                                                                                                                          |
| A-22 | RPC grants and referral/admin enumeration              | **Partially fixed**              | Staging routine privileges confirm `check_is_admin` is no longer granted to anon (only `authenticated`); `auto_generate_referral_code` and `generate_referral_code` are no longer granted to anon. `has_project_access(uuid)` is intentionally still granted to anon. `app/api/public/validate-referral-code/route.ts:67-75` and `app/api/validate-referral-code/route.ts:88-97` keep a uniform message and add a small random delay, but the `valid: !!profile` boolean still exists — referral-code existence remains observable to a rate-limited probe. See `F-011`/`F-012`.                         |
| A-23 | Health secret timing-safe                              | **Verified fixed**               | `supabase/functions/health/index.ts:20-27, 44` uses `crypto.subtle.timingSafeEqual` with a `try/catch` that returns `false` on length mismatch. Same pattern in `view-scraper`.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| A-24 | Realtime publication membership                        | **Not fixed**                    | Staging `pg_publication_tables WHERE pubname='supabase_realtime'` still includes `coming_soon_emails` and `email_send_history`. Direct exposure is gated by admin-only RLS, but the publication membership remains a defense-in-depth concern. See `F-004`.                                                                                                                                                                                                                                                                                                                                              |
| A-25 | Account deletion withdrawal anonymization              | **Not fixed**                    | `app/api/account/delete/route.ts:79-130` anonymizes `payment_audit_log` and `keepz_payments` only — no `withdrawal_requests` `user_id = NULL` update before `auth.admin.deleteUser`. See `F-003`.                                                                                                                                                                                                                                                                                                                                                                                                        |
| A-26 | `wavleba.ge` domain typo                               | **Partially fixed**              | `lib/email-templates.ts:48-66` now uses `process.env.NEXT_PUBLIC_APP_URL` with `https://swavleba.ge` fallback, and the visible footer points to `swavleba.ge`. **However**, `supabase/functions/_shared/email.ts:38, 55, 250` still hardcode `https://wavleba.ge` and `Swavleba <no-reply@wavleba.ge>`. Edge functions (enrollment-approved, withdrawal-approved/rejected, bundle-enrollment notifications) still emit links and From addresses on the typo domain. See `F-002`.                                                                                                                         |

# Validated new or remaining vulnerabilities

# Finding ID: F-001

#### Issue

Signup → delete → resignup loop grants a fresh welcome discount and a fresh month of project access on every cycle.

#### Severity

**High**. A non-privileged authenticated user can repeatedly self-grant a 12-hour discount window plus a one-month free project-access entitlement at zero cost. The discount is monetary; the project-access month materially affects the platform's subscription business model. This was flagged as A-2 in the codex review and remains unaddressed.

#### Status

Remaining (incomplete fix — no fix shipped).

#### What is causing it

`handle_new_user` (Supabase auth trigger) unconditionally sets `welcome_discount_expires_at = NOW() + INTERVAL '12 hours'` and `project_access_expires_at = NOW() + INTERVAL '1 month'` for every new auth user. `app/api/account/delete/route.ts` performs `serviceSupabase.auth.admin.deleteUser(user.id)` (line 132), which removes the auth user. The user can then re-sign-up with the same email and become a "new" user from `handle_new_user`'s perspective.

There is no normalized-email tombstone, no `previously_registered` table, and no signup-time check that suppresses the welcome grants for repeat email addresses.

#### Evidence

- Staging `pg_get_functiondef('handle_new_user')` (commit-of-record body): the `INSERT INTO public.profiles (...)` statement always sets the welcome columns based on current time, with no historical lookup.
- `app/api/account/delete/route.ts:132`: `await serviceSupabase.auth.admin.deleteUser(user.id)` is the only deletion step; no rows are written to a tombstone/cooldown table.
- No migration in `supabase/migrations/` introduces `deleted_emails` / `email_tombstones` / equivalent.

#### Impact

- Authenticated user repeatedly redeems the welcome discount on enrollments (the discount is applied to course price during checkout).
- Authenticated user repeatedly obtains a free month of project access (`project_access_expires_at`), bypassing the paid `project_subscriptions` flow.
- The cycle is automatable client-side: signup → confirm email → delete → repeat. Email confirmation is the only friction; using a `+alias` or rotating mailboxes is trivial.

#### Exploit path

1. Attacker (anonymous → authenticated) signs up with `student@example.com`.
2. After email confirmation, profile has fresh `welcome_discount_expires_at` (12h) and `project_access_expires_at` (1 month).
3. Attacker uses the discount and project access.
4. Attacker calls `DELETE /api/account/delete` with their password. The route accepts because `profile.role === 'student'` (lecturers/admins are blocked at line 55-60). `auth.users` row is hard-deleted.
5. Attacker repeats step 1 with the same or aliased email. `handle_new_user` runs again with no memory of the prior account; both welcome timers reset.

#### Recommended fix

Minimal, behavior-preserving:

1. New table `public.deleted_email_tombstones (email_normalized text primary key, deleted_at timestamptz default now())`. RLS-protected, service-role-only.
2. In `app/api/account/delete/route.ts`, before `deleteUser`, INSERT `lower(trim(user.email))` into the tombstone (`ON CONFLICT DO UPDATE SET deleted_at = NOW()`).
3. In `handle_new_user`, after computing `user_username`, look up the email in the tombstone. If present, set `welcome_discount_expires_at = NULL` and `project_access_expires_at = NOW()` (no grace) for that signup. Optionally also surface a flag `previous_account_deleted = true` to inform the user UI.
4. Document and accept that legitimate users who delete and return are intentionally not granted the welcome perks again; the verification email flow itself remains unchanged.

Do **not** attempt to block re-registration entirely (that's a UX regression) — only suppress the welcome perks.

#### Regression risk

Low if scoped narrowly. The risk is mis-detecting a legitimate "I changed my mind, signing up again" user. Acceptable because they still get a working account; only the welcome perks are withheld.

#### Verification steps after fix

1. Apply migrations to staging only.
2. As a disposable staging test user `t1+resignup@swavleba.ge`:
   - Sign up, verify, confirm `welcome_discount_expires_at IS NOT NULL` and `project_access_expires_at > NOW() + INTERVAL '29 days'`.
   - Delete account.
   - Sign up again with same email (after confirmation).
   - Verify `welcome_discount_expires_at IS NULL` and `project_access_expires_at <= NOW()`.
3. Staging SQL: `SELECT email_normalized, deleted_at FROM public.deleted_email_tombstones ORDER BY deleted_at DESC LIMIT 10;` to confirm tombstone is populated.
4. Confirm `pg_get_functiondef('handle_new_user')` includes the tombstone lookup.

---

# Finding ID: F-002

#### Issue

Edge-function emails still link to and originate from the typo domain `wavleba.ge`.

#### Severity

**Low**. Phishing and brand confusion risk. If `wavleba.ge` is ever registered by an attacker, every edge-function email becomes a free phishing vector. Reputation hit even if it isn't registered (broken footer link).

#### Status

Incomplete previous fix. The Next.js `lib/email-templates.ts` was updated to use `NEXT_PUBLIC_APP_URL` with a `swavleba.ge` fallback; the parallel edge-function template was missed.

#### What is causing it

`supabase/functions/_shared/email.ts:38` hardcodes `const SITE_URL = "https://wavleba.ge"`. The footer at `:55` links to `wavleba.ge` and `:250` defaults the From address to `Swavleba <no-reply@wavleba.ge>`.

#### Evidence

- `supabase/functions/_shared/email.ts:38`: `const SITE_URL = "https://wavleba.ge";`
- `supabase/functions/_shared/email.ts:55`: `<p><a href="${SITE_URL}" style="...">wavleba.ge</a></p>`
- `supabase/functions/_shared/email.ts:250`: `const from = Deno.env.get("EMAIL_FROM") || "Swavleba <no-reply@wavleba.ge>";`
- Templates that flow through here: `enrollmentApproved`, `enrollmentRejected`, `withdrawalApproved`, `withdrawalRejected`, `bundleEnrollmentApproved`, `bundleEnrollmentRejected`.

#### Impact

Every transactional edge-function email contains a clickable `wavleba.ge` link in the footer and (unless `EMAIL_FROM` is overridden in env) sends from `no-reply@wavleba.ge`. Recipients who hover/inspect see the typo and may distrust the platform; an attacker who registers `wavleba.ge` gains a turnkey phishing position.

#### Exploit path

Passive: register `wavleba.ge`, set up MX/SPF, observe that legitimate Swavleba users click the footer link and arrive on the attacker's site, then mount lookalike credential phishing.

#### Recommended fix

- `supabase/functions/_shared/email.ts:38` → `const SITE_URL = Deno.env.get("PUBLIC_APP_URL") || "https://swavleba.ge";`
- `:55` footer text/href → `swavleba.ge`.
- `:250` From default → `"Swavleba <no-reply@swavleba.ge>"`.
- Confirm `EMAIL_FROM` and `PUBLIC_APP_URL` are set on staging/prod edge function secrets.

#### Regression risk

None — the env var override is preserved. If `swavleba.ge` is the canonical domain, no behavior changes.

#### Verification steps after fix

- `grep -n wavleba supabase/functions/_shared/email.ts` returns empty.
- Trigger a staging-side enrollment-approved email through the dev/test flow; inspect the rendered HTML for `swavleba.ge` only.

---

# Finding ID: F-003

#### Issue

Account deletion does not anonymize `withdrawal_requests`.

#### Severity

**Low**. Data hygiene / "right to be forgotten" gap. Withdrawal rows retain the original `user_id` after `auth.users` is deleted, leaving an orphaned reference that may persist personal banking metadata indirectly via `kyc_submission_id`.

#### Status

Remaining (incomplete previous fix).

#### What is causing it

`app/api/account/delete/route.ts:79-130` updates `payment_audit_log.user_id = NULL` and `keepz_payments.user_id = NULL`, but `withdrawal_requests` is not touched before `auth.admin.deleteUser(user.id)` at line 132.

#### Evidence

- `app/api/account/delete/route.ts:79-110` shows only `payment_audit_log` and `keepz_payments` anonymization.
- `withdrawal_requests` schema has a non-nullable `user_id uuid NOT NULL REFERENCES auth.users(id)` (per migration 217). Confirm nullability before the fix.

#### Impact

After deletion, `withdrawal_requests.user_id` either points to a now-nonexistent `auth.users` row (if FK is `ON DELETE CASCADE`, the row would be cascaded — verify) or, if `ON DELETE SET NULL` / no cascade, the row keeps the old UUID. Either way, the row's `bank_account_number` and `kyc_submission_id` link back to the deleted person's banking data. Audit trail value is real; minimum-data principle says it should be anonymized.

#### Exploit path

No active exploit; this is a data-protection gap.

#### Recommended fix

Either:

- Make `withdrawal_requests.user_id` nullable (mirror the pattern used for keepz_payments) and add `await serviceSupabase.from("withdrawal_requests").update({ user_id: null }).eq("user_id", user.id);` between lines 109 and 111, **before** `auth.admin.deleteUser`.
- OR add `ON DELETE SET NULL` to the FK definition and rely on cascade.

#### Regression risk

Low. Admin-side withdrawal lookups already join `profiles` for display; nullable `user_id` rows render as "deleted user" in the admin UI.

#### Verification steps after fix

- Staging: create a disposable user, place a withdrawal request, delete account, verify `SELECT user_id FROM withdrawal_requests WHERE id = $request_id` returns NULL.

---

# Finding ID: F-004

#### Issue

`coming_soon_emails` and `email_send_history` are still members of the `supabase_realtime` publication.

#### Severity

**Low** (Informational / defense-in-depth). Direct exposure is gated by admin-only RLS; the publication membership becomes load-bearing only if RLS is ever relaxed.

#### Status

Remaining.

#### What is causing it

The original migrations that added these tables to `supabase_realtime` were never reversed. No migration drops them.

#### Evidence

- Staging `SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname='supabase_realtime'` includes `coming_soon_emails` and `email_send_history`.
- Staging `pg_policies` for both tables: only the admin-role SELECT policy is present, so an authenticated client subscription would receive zero rows today.

#### Impact

None today. Future RLS edits could inadvertently expose pending email queues / send history in real time to a client that already opens a `supabase_realtime` channel for the table.

#### Recommended fix

Add a small migration: `ALTER PUBLICATION supabase_realtime DROP TABLE public.coming_soon_emails, public.email_send_history;` and verify no client opens a channel against either table (`grep -rn 'coming_soon_emails\|email_send_history' app components hooks`).

#### Regression risk

None if the codebase doesn't subscribe.

#### Verification steps after fix

- Staging: `SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename IN ('coming_soon_emails','email_send_history');` returns 0 rows.

---

# Finding ID: F-005

#### Issue

Pinned Next.js dependency on the `^14.2.x` line is on the same series as published RSC / image-optimizer DoS advisories. The fix-shipping commits did not upgrade.

#### Severity

**Low** (operational / availability). No reachable code-execution exploit. Whether a specific advisory applies depends on the resolved minor version; `^14.2.35` allows but does not guarantee a patched line.

#### Status

Remaining.

#### What is causing it

`package.json:38` pins `"next": "^14.2.35"`. Lockfile resolution may be on `14.2.35` exactly. Codex's prior recommendation (track upstream advisories or apply WAF coverage) was not actioned.

#### Evidence

- `package.json:38`: `"next": "^14.2.35"`.
- No upgrade commit in `git log 92d1362..HEAD --oneline -- package.json`.

#### Impact

If the resolved version matches a known DoS advisory and the affected route is reachable (image optimizer, RSC), an unauthenticated attacker can degrade availability via crafted requests. Image optimizer caching headers in `next.config.js:106-114` already aggressively cache `/_next/image` (`public, max-age=31536000, immutable`), which dampens the most commonly cited optimizer-DoS path.

#### Recommended fix

- Run `npm audit --omit=dev` and confirm which advisories apply to the resolved `next` version.
- Either bump within the `14.2.x` line to the latest patched release or plan a 14.2 → latest-stable upgrade in a separate branch with full smoke tests.
- Do not run `npm audit fix --force` in a hot fix — it can rewrite peer-dependency trees.

#### Regression risk

Bumping within `14.2.x` is generally low-risk if release notes are reviewed; major-line moves are non-trivial.

#### Verification steps after fix

- `npm audit --omit=dev | grep -i next` returns no high/critical that affects reachable surfaces.
- `npm run build && npm start` smoke against the public marketing pages and the `/_next/image` route.

---

# Finding ID: F-006

#### Issue

Admin notification consent-bypass abuse path is throttled but not eliminated.

#### Severity

**Low**. Requires a malicious or compromised admin and is now capped at 1000 emails/24h per admin via `email_send_history` counting. Risk shifted from "marketing fanned out as transactional" to "1000 marketing-as-transactional per admin per day".

#### Status

Partially fixed (mitigation added; root cause — body-supplied `category` driving `effectiveRespectConsent` — unchanged).

#### What is causing it

`app/api/admin/notifications/send/route.ts:350-355` reads `category` from request body and sets `effectiveRespectConsent = !TRANSACTIONAL_CATEGORIES.has(category)`. Any admin can send a payload with `category: "transactional_account"` and bypass `marketing_emails_consent`, up to the new daily cap.

The cap is implemented at lines 547-584 by counting prior `email_send_history` rows from the same admin where `metadata->>override_consent='true'` and `metadata->>target_type='all'` in the last 24h. The cap is fail-closed (returns 503 if the count query errors).

#### Evidence

- Route source as quoted above.
- `email_send_history` is INSERTed at `:622-644` with `metadata.override_consent = effectiveRespectConsent ? 'false' : 'true'`, supplying the data the cap query reads.

#### Impact

A compromised admin token can mass-mail up to 1000 non-consenting users per day under the guise of `transactional_*`. Below that cap, no second control fires.

#### Recommended fix (codex's original recommendation, still applies)

- Bind transactional categories to a small set of approved server-side templates/events (no body-supplied `category` for transactional sends).
- Or require a second admin's approval/code for any send where `target_type='all' && override_consent`.
- Keep the daily cap as a belt-and-braces measure.

#### Regression risk

Legitimate transactional sends typically target individuals or small groups, not `target_type='all'`. Restricting body `category` to `marketing` and routing transactional sends through dedicated event-driven endpoints is a net simplification.

#### Verification steps after fix

- A POST to `/api/admin/notifications/send` with `category: 'transactional_account', target_type: 'all'` returns 403 (or whatever the chosen rejection is) regardless of cap state.
- Existing transactional event-driven mailers (lecturer-approved, KYC-approved, etc.) keep working.

---

# Finding ID: F-007

#### Issue

Signup endpoint leaks account existence (separate from the now-unified signin endpoint).

#### Severity

**Low**. Account-enumeration oracle: an attacker can determine whether `email@example.com` is registered on Swavleba by attempting signup with that email and observing the error message. Mitigated by the email-confirmation step but not eliminated.

#### Status

New (the fix for A-14 unified signin only).

#### What is causing it

`lib/auth.ts:78-99` distinguishes three signup outcomes:

- Email already registered & confirmed → Supabase `signUp` returns an error containing `"already registered"` → caught and rethrown as `"An account with this email already exists. Try signing in instead."`
- Email already registered & unconfirmed → Supabase returns success with empty `data.user.identities` → caught and rethrown with the same message.
- New email → success (no error).

Both pre-existing branches produce a distinct, observable message vs the new-email branch.

#### Evidence

- `lib/auth.ts:75-92`: explicit branch on `error.message.includes("already registered")`.
- `lib/auth.ts:95-99`: explicit branch on empty `identities`.

#### Impact

Anonymous attacker can probe email existence at signup-rate-limit speed (Supabase auth own limiter). Combined with `validate-referral-code` (still booleans `valid` true/false) and `has_project_access(uuid)` (anon-callable), the platform leaks several existence oracles. None individually exposes payment / role / PII; combined, they assist targeted phishing.

#### Exploit path

Anon attacker hits the public signup page with target email, observes whether the message is the generic "An account with this email already exists" vs the success state.

#### Recommended fix

The standard mitigation is to always return the confirmation-email-sent UX regardless of whether the email already exists, and let the email itself disambiguate (a real new user gets a confirmation email; an existing confirmed user gets a "you already have an account, sign in" email; an existing unconfirmed user gets a re-send confirmation email). Implementing this is non-trivial — likely deferred. As a minimal hedge, lower the signup-route IP rate limit and remove the distinct identity-check branch that produces the same message regardless.

#### Regression risk

Medium for the full mitigation (changes user-visible signup UX). Low for the minimal hedge.

#### Verification steps after fix

- Submit signups for `existing-confirmed@`, `existing-unconfirmed@`, `new@` from staging and confirm the user-visible response is identical.

---

# Finding ID: F-008

#### Issue

Apify API token leaked in URL query string of edge-function `view-scraper`.

#### Severity

**Low**. Operational / secret hygiene. Reverse-proxies, logging infrastructure, and Apify-side request logs may capture the URL with `?token=...`.

#### Status

Remaining (not previously flagged).

#### What is causing it

`supabase/functions/view-scraper/index.ts` passes `apifyToken` in the URL query string for every Apify request — e.g. `:389` `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/runs?token=${apifyToken}` and the symmetric Instagram, dataset, and run-status endpoints at `:421, :493, :521, :629`.

#### Evidence

- The token is `Deno.env.get("APIFY_API_TOKEN")` (server-side secret) but is then concatenated into the request URL rather than sent as `Authorization: Bearer …`.

#### Impact

URLs with secrets routinely appear in (a) Supabase function execution logs, (b) Apify request logs, (c) any HTTP intermediary. Rotation cost rises.

#### Recommended fix

Apify accepts the token in the `Authorization: Bearer` header. Move `apifyToken` to a header on each fetch call and strip it from the URL.

#### Regression risk

None — Apify's API supports both methods.

#### Verification steps after fix

- `grep -n 'token=' supabase/functions/view-scraper/index.ts` returns zero matches in URL strings.
- A staging dev-mode `view-scraper` invocation succeeds end-to-end (TikTok and Instagram paths).

---

# Finding ID: F-009

#### Issue

`has_project_access(uuid)` is anon-executable and acts as a rate-limited project-access enumeration oracle.

#### Severity

**Low** (informational). Can only confirm "this UUID has project access" — does not leak email/PII/payment state. Codex flagged the residual gap as part of A-22; it is intentionally retained because RLS for `has_project_access(auth.uid())` policies still need anon-callable access for unauthenticated probes.

#### Status

Partially fixed / accepted by design (mig 241 explicitly leaves the anon grant).

#### What is causing it

Staging routine privileges show `has_project_access` granted EXECUTE to `anon` and `authenticated`. Body returns boolean.

#### Evidence

- `information_schema.routine_privileges` returns `has_project_access | anon | EXECUTE` and `has_project_access | authenticated | EXECUTE`.
- `pg_get_functiondef('has_project_access')` is a SECURITY DEFINER body returning `EXISTS(...) OR EXISTS(...)` over `profiles.project_access_expires_at` and `project_subscriptions.status`.

#### Impact

Anon can probe arbitrary UUIDs and learn whether they currently have project access. Useless without the UUID itself; combined with other UUID-leaking surfaces, weakly informative.

#### Recommended fix

Rework the RLS policies that depend on anon-callable `has_project_access` so the anon grant can be revoked. If that's intractable, document the residual risk explicitly in a migration comment (already done in `241_revoke_anon_grants_security.sql:46`).

#### Regression risk

Medium if RLS is changed alongside; current state is acceptable.

#### Verification steps after fix

- Staging: confirm anon-tokenless calls to `rpc('has_project_access', { uid: '...' })` return `false` (or fail) without breaking the unauthenticated UI flow.

---

# Finding ID: F-010

#### Issue

Referral-code validation endpoints still expose a boolean existence oracle for arbitrary referral codes.

#### Severity

**Low** (informational). Rate-limited (5/60s anon, 10/60s authenticated) and the response message is uniform, but the boolean `valid` field still allows enumeration via timing/scripting.

#### Status

Partially fixed.

#### What is causing it

- `app/api/public/validate-referral-code/route.ts:73-75`: `return NextResponse.json({ valid: !!profile, message: "Referral code checked" });`
- `app/api/validate-referral-code/route.ts:94-97`: same pattern.

The `await new Promise(r => setTimeout(r, 100 + ...))` adds jitter but does not hide the boolean.

#### Evidence

Source as cited.

#### Impact

An attacker can enumerate referral codes (which are 6-character alphanumeric — searchable). The codes themselves don't grant access but link to user identity; combined with `signup_referral_code` UX, an attacker could harvest codes for downstream social engineering.

#### Recommended fix

- Consolidate validation into the signup form's submission step (server-side validation at signup, not an exposed lookup endpoint).
- If the public lookup must remain, drop the boolean — return `{ message: "If the code is valid, it will be applied at signup." }` always; only validate at signup time.

#### Regression risk

The signup UX currently provides immediate feedback ("invalid code"); removing it is a real UX regression for legitimate referrers. Trade-off.

#### Verification steps after fix

- Anon POST with random codes returns identical response shapes; only signup itself surfaces validity.

---

# Finding ID: F-011

#### Issue

`create_withdrawal_request` checks the "no other pending withdrawal" predicate without `FOR UPDATE` on the profiles row, allowing a TOCTOU under concurrent calls.

#### Severity

**Low**. Worst case is a user creating two pending withdrawal rows for the same balance. The `debit_user_balance` call serializes via `SELECT ... FOR UPDATE` on `profiles` and enforces `IF v_balance_before < p_amount THEN RAISE EXCEPTION`, so the user cannot withdraw more than their balance — but they can stack two pending rows under separate `kyc_submission_id` references, causing operational noise on the admin side.

#### Status

New (not previously flagged, not flagged in codex review).

#### What is causing it

`create_withdrawal_request`:

- Line ~`SELECT COALESCE(SUM(amount), 0) INTO v_pending_withdrawal FROM public.withdrawal_requests WHERE user_id = v_user_id AND status = 'pending';` (no `FOR UPDATE`).
- `IF v_pending_withdrawal > 0 THEN RAISE EXCEPTION 'You already have a pending withdrawal request';`
- Then `INSERT INTO withdrawal_requests` and `PERFORM debit_user_balance(...)`.

Two parallel calls can both observe `v_pending_withdrawal = 0` before either commits.

#### Evidence

Staging `pg_get_functiondef('create_withdrawal_request')` body shown above. No row-lock on the predicate row.

#### Impact

User can briefly create two pending withdrawal rows; both will hold balance via `debit_user_balance`. Admin sees both. No double-spend (each row holds its own funds), but the admin workflow is polluted.

#### Recommended fix

Add a unique partial index `CREATE UNIQUE INDEX idx_withdrawal_requests_one_pending_per_user ON public.withdrawal_requests (user_id) WHERE status = 'pending';`. The second concurrent INSERT then fails with a unique-constraint violation, which the API can map to a clean 409.

#### Regression risk

Low. Existing UX already says "you have a pending request"; the constraint just makes the truth atomic.

#### Verification steps after fix

- Stress-test on staging with two simultaneous `create_withdrawal_request` calls from the same user; confirm only one row exists.

---

## New vulnerabilities introduced by previous fixes

**None validated.**

Notes / behaviour-only risks (not vulnerabilities):

- The new `protect_profiles_privileged_columns` body blocks user-token UPDATEs of `email`, `full_name`, and `bank_account_number`. The auto-encrypt trigger sets these to NULL after writing the encrypted column, so legitimate user-token UPDATEs that omit these fields are unaffected. The narrow service-role write surface (`/api/balance` PATCH for IBAN, route-comment at `:118-121`) is preserved. Confirmed safe.
- `complete_keepz_payment` re-credits balance on the `status='success'` already-completed branch when `balance_transactions` is empty (recovery for the prior A-5 risk). This is by design and gated by EXISTS on `balance_transactions(reference_id, source)`. No regression.
- `approve_bundle_enrollment_request(uuid)` (1-arg overload) credits the lecturer; the 2-arg overload (payment-driven path) does not credit (credit happens via `complete_keepz_payment`). Both are status-fenced. No double-credit path remains.
- `protect_profiles_kyc_status` uses `pg_trigger_depth() = 1` instead of role check. This is functionally equivalent for normal direct-PATCH attempts (top-level depth) and allows the legitimate `sync_profile_kyc_status` propagation from `kyc_submissions` (depth=2). Not a regression, just a different mechanism than the role-check used by `protect_profiles_role`.

## False positives / excluded items

- **`approve_lecturer_account` and `reject_lecturer_account` lack `FOR UPDATE`.** Excluded — the WHERE clause on the UPDATE includes the status fence (`lecturer_status = 'pending' OR (...)`). Idempotency is preserved. No balance side-effects exist on lecturer approval/rejection, so the relaxed locking has no money impact.
- **Admin `complete_keepz_payment` manual completion strips audit fields via `_keepz_redact_callback`.** Excluded — `logAdminAction` captures the manual completion separately in `audit_log`.
- **Service-role write in `/api/balance` PATCH for `bank_account_number`.** Excluded — the route is auth-gated, IBAN-validated, pins the write to `user.id`, and the column is otherwise blocked by `protect_profiles_privileged_columns` per design. Safe and minimal.
- **Trigger for `auto_encrypt_pii` runs at SECURITY DEFINER with `search_path=public, extensions, pg_temp`.** Excluded — necessary for accessing `pgcrypto` in the `extensions` schema. Reviewed and safe.
- **`get_decrypted_profiles` returns `email, full_name, bank_account_number`.** Excluded — service-role-only grant (confirmed). Used only by `app/api/admin/users-with-emails` (admin gate + rate limit + audit) and the admin notification email path (admin gate + rate limit).
- **`saved_cards.card_token` collisions across users.** Excluded — `UNIQUE (user_id, card_token)` index in staging matches code's `onConflict: "user_id,card_token"`.
- **`view-scraper` dual-auth (secret OR admin JWT).** Excluded — secret comparison is timing-safe; manual path requires admin via `checkIsAdmin`.
- **CSP header in `middleware.ts`.** Excluded as a vulnerability — `style-src 'unsafe-inline'` is documented and necessary for Tailwind; `script-src` uses per-request nonces; `frame-ancestors 'self'` blocks clickjacking.
- **`dangerouslyAllowSVG: true` in `next.config.js`.** Excluded as a vulnerability — paired with restrictive `contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"` on the optimizer; SVGs originate from admin uploads only per source comment.
- **Realtime publication membership of money/PII tables (`keepz_payments`, `withdrawal_requests`, `balance_transactions`, `kyc_submissions`, `referrals`).** Excluded — all have user-scoped RLS (`auth.uid() = user_id`). Realtime subscriptions return only the caller's own rows.

## Security hardening recommendations

These are not vulnerabilities; they are practical, low-risk hardening items that improve the platform without changing user-facing behaviour.

1. **Revoke unnecessary column privileges on `profiles`.** Today `anon` and `authenticated` have raw `INSERT/UPDATE/SELECT` on every `profiles` column (including `balance`, `is_approved`, `role`, `kyc_status`). Trigger-based protection is the actual control, but a layered fix is `REVOKE UPDATE ON public.profiles FROM anon, authenticated; GRANT UPDATE (avatar_url, marketing_emails_consent, terms_accepted) ON public.profiles TO authenticated;` and equivalent for `INSERT`. Belt-and-braces.
2. **Add the `WHERE status='pending'` partial unique index on `withdrawal_requests` (see F-011)** to make the "one pending withdrawal per user" rule atomic.
3. **Drop unused tables from `supabase_realtime` (see F-004).**
4. **Move the Apify token to an Authorization header (see F-008).**
5. **Decommission `coming_soon_emails` realtime row-level access if there is no client subscriber.** Several sensitive tables in the publication are admin-only via RLS — fine — but inventory which client paths actually subscribe (chat-only, channels-only, message-only) and prune the rest.
6. **Document and bind transactional notification categories to server-emitted events (see F-006)** rather than trusting the body `category`.
7. **Track the Next.js advisory list (see F-005)** and roll forward within `14.2.x` as soon as a security release ships.
8. **Add a CI check that fails the build if `wavleba.ge` appears in `lib/` or `supabase/functions/`** so the typo can never re-land.
9. **Add a tombstone-aware `handle_new_user` (see F-001)** — the only blocking item in this audit.
10. **Document the "anon `has_project_access` is intentional" decision in CLAUDE.md / docs** so future audits don't re-flag it. The migration comment at `241_revoke_anon_grants_security.sql:46` already captures this; surfacing it at the docs level is cheap.
11. **Consider a column-level `REVOKE`/`GRANT` cleanup on `profiles`** so the trigger isn't the sole defense — column-level grants are the canonical mechanism and reduce blast radius if a trigger is ever inadvertently disabled.

## Final verdict

**Not blocked, but with one High-severity recommended-fix-before-prod item.**

| Pre-deploy blocker                                      | Status                                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| F-001 Signup-delete-resignup welcome / free-month abuse | **Recommended to fix before prod** — High severity, real exploit path, scoped fix.               |
| F-002–F-011                                             | **Acceptable for prod** — Low severity, hygiene / defense-in-depth. Track in a follow-up sprint. |

If F-001 is acknowledged-risk-accepted (e.g. anti-abuse is handled at a different layer such as email-provider-level signup velocity limits), the codebase is **safe to commit, push, and deploy from a security perspective**, with the understanding that the hardening list above remains open work.

Detailed staging-runtime evidence for every "Verified fixed" row in the matrix above is reproducible via:

```sql
-- Trigger bodies
SELECT proname, pg_get_functiondef(oid) FROM pg_proc
 WHERE pronamespace='public'::regnamespace
   AND proname IN ('protect_profiles_privileged_columns','protect_profiles_role',
                   'protect_profiles_kyc_status','complete_keepz_payment',
                   'approve_project_subscription','approve_bundle_enrollment_request',
                   'approve_enrollment_request','reject_enrollment_request',
                   'create_withdrawal_request','process_signup_referral_on_enrollment',
                   'complete_own_profile','get_safe_profiles','_keepz_redact_callback',
                   'handle_new_user');

-- Profiles triggers + saved-cards index
SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger
 WHERE tgrelid='public.profiles'::regclass AND NOT tgisinternal;
SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='saved_cards';

-- Submission_reviews policies + realtime publication
SELECT policyname, cmd, qual FROM pg_policies
 WHERE schemaname='public' AND tablename='submission_reviews';
SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime';

-- RPC grants
SELECT routine_name, grantee FROM information_schema.routine_privileges
 WHERE routine_schema='public' AND grantee IN ('anon','authenticated','PUBLIC');
```

All of the above were executed read-only against staging (`bvptqdmhuumjbyfnjxdt`) during this audit; production was not touched.
