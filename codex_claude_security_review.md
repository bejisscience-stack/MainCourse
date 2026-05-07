# Codex Review of Claude Security Fixes

## Scope

Reviewed `final_security_guide.md`, current git state, Claude's changed files, new migrations, Supabase functions, API routes, RLS/RPC migration definitions, package files, and build/typecheck behavior. This is an independent verification of Claude's attempted fixes, not an acceptance of prior conclusions.

## Environment

- Branch: `deps/security-fixes-staging`
- Commit: `92d1362`
- Working tree status: Dirty. Modified tracked files plus untracked guide/audit files, one new admin route, and four new migrations.
- Production touched: No
- Staging/local used: Local static/code verification and local build/typecheck. Read-only staging SQL was attempted but blocked by network routing to Supabase Postgres IPv6 (`no route to host`). No staging writes were run.

## Executive Summary

- Fully fixed: 0
- Partially fixed: 5
- Not fixed: 21
- Fixes introduced new risks: 0 validated new vulnerabilities; 3 behavior/rollout risks noted
- Recommendation: Not safe to move toward staging/prod review yet. Several High/Critical items from the guide remain unaddressed, especially signup/delete abuse, Keepz payment consistency, admin approval races, card payload/token handling, login enumeration, URL host validation, and rate-limit/admin route gaps.

## Verification Matrix

| Issue ID | Claude Fix Status | Codex Verdict | Evidenc | Risk |
|---|---|---|---|---|
| A-1 | Local migration extends `protect_profiles_privileged_columns` | Partially fixed | `supabase/migrations/20260507104902_extend_protect_profiles_privileged_columns.sql:67` blocks `welcome_discount_expires_at`; staging runtime not verified | Critical if migration not applied |
| A-2 | No observed tombstone/cooldown fix | Not fixed | `app/api/account/delete/route.ts:132` still hard-deletes auth user; no deleted-email table or signup gate found | High |
| A-3 | Local migration removes email from RPC and adds admin route | Partially fixed | `239_drop_email_from_get_safe_profiles.sql:21` returns no email; `app/api/admin/users-with-emails/route.ts` is admin-only | High until deployed/runtime verified |
| A-4 | No dependency upgrade | Not fixed | `package.json` still has `"next": "^14.2.35"` | High availability risk |
| A-5 | No RPC ordering fix | Not fixed | `210_keepz_amount_based_accounting.sql:250` still sets `status='success'` before nested business logic | High lost-payment/access risk |
| A-6 | No pending fence/race fix | Not fixed | `108_approve_subscription_updates_profile.sql:35`; `178_platform_commission.sql:556`/`:570` lack `status='pending'` fences | High double-approval risk |
| A-7 | No TOCTOU fix | Not fixed | `178_platform_commission.sql:489` selects pending without `FOR UPDATE`; `:515` updates without status fence | High double-credit risk |
| A-8 | Local trigger migration protects privileged columns | Partially fixed | `20260507104902...sql:76`, `:82`, `:97`, `:115` cover referral/PII columns; staging runtime not verified | Medium if unapplied |
| A-9 | No policy-drop migration observed | Not fixed | No migration drops `"Authenticated users can view submission reviews"`; current migrations still include broad project-access review policy | Medium review/payout visibility |
| A-10 | Local RPC guard added | Partially fixed | `240_guard_process_signup_referral.sql:41` checks `p_user_id <> auth.uid()` | Medium until deployed/runtime verified |
| A-11 | No manual bundle idempotency fix | Not fixed | `178_platform_commission.sql:567` credits lecturer unguarded in manual bundle approval | Medium duplicate payout |
| A-12 | No hostname parser fix | Not fixed | `lib/video-url-parser.ts:19`, `:31`; `supabase/functions/view-scraper/index.ts:15` still use `includes` | Medium spoofed host |
| A-13 | No category/template binding or second gate | Not fixed | `app/api/admin/notifications/send/route.ts:350` trusts body category; `:355` bypasses consent | Medium consent bypass |
| A-14 | No login error unification | Not fixed | `lib/auth.ts:141` still returns distinct unconfirmed-account message | Medium enumeration |
| A-15 | No callback payload scrubbing | Not fixed | `callback/route.ts:253` passes full callback; `:352` stores failed callback payload | Medium PCI/data-at-rest risk |
| A-16 | No user-scoped saved-card uniqueness | Not fixed | `114_saved_cards.sql:20` unique on `card_token`; callback `onConflict: "card_token"` at `callback/route.ts:334` | Medium cross-user clobber |
| A-17 | No collision cleanup | Not fixed | Duplicate prefixes remain: 103,104,105,131,140,168,183,224,233,234,237 | Medium migration drift |
| A-18 | No route rate limits | Not fixed | `chat-media/sign` and `dm/media-url` authorize but have no limiter before signed URL creation | Medium-low cost abuse |
| A-19 | Service-role blast radius remains | Not fixed | `app/api/complete-profile/route.ts:42` still uses `createServiceRoleClient(token)` for profile update | Low defense-in-depth |
| A-20 | DB-side IBAN validation absent | Not fixed | API validates at `withdrawals/route.ts:108`; RPC inserts `p_bank_account_number` at `217_withdrawal_kyc_gate.sql:76` | Low workflow abuse |
| A-21 | Admin payments/settings gaps remain | Not fixed | `admin/payments/route.ts:23`/`:73` manually checks admin with no limiter; `admin/settings/route.ts:40` returns `updated_by` to any authed caller | Low |
| A-22 | Some grants/messages changed, but enumeration remains | Partially fixed | `241_revoke_anon_grants_security.sql:32` revokes `check_is_admin`; `:46` intentionally keeps `has_project_access`; public endpoint still returns `valid` at `public/validate-referral-code/route.ts:73` | Low |
| A-23 | No timing-safe health secret fix | Not fixed | `supabase/functions/health/index.ts:31` still uses `!==` | Low |
| A-24 | No realtime publication drop | Not fixed | No migration drops `coming_soon_emails` or `email_send_history` from `supabase_realtime` | Low latent leak |
| A-25 | Withdrawal anonymization missing | Not fixed | Account delete anonymizes `payment_audit_log` and `keepz_payments`, not `withdrawal_requests` | Low data hygiene |
| A-26 | Domain typo remains | Not fixed | `lib/email-templates.ts:44` and `supabase/functions/_shared/email.ts:38` still use `https://wavleba.ge` | Low phishing/UX |

## Detailed Findings

### A-1 / `welcome_discount_expires_at` direct mutation

#### Codex verdict
Partially fixed

#### What Claude did
Added `supabase/migrations/20260507104902_extend_protect_profiles_privileged_columns.sql`, replacing `protect_profiles_privileged_columns()` and blocking user-role changes to `welcome_discount_expires_at`.

#### What is still wrong
The code-level fix is correct in shape, but it is an untracked local migration and staging runtime could not be queried. I cannot prove the deployed trigger body contains this clause or that authenticated PostgREST PATCH now fails.

#### Evidence
`supabase/migrations/20260507104902_extend_protect_profiles_privileged_columns.sql:67` raises `42501` when `welcome_discount_expires_at` changes under `authenticated`/`anon`.

#### Security impact
If the migration is not applied, any authenticated user can still extend their welcome discount indefinitely.

#### Safe remediation
Apply the migration to staging, then verify with:

```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname='protect_profiles_privileged_columns'
AND pronamespace='public'::regnamespace;
```

### A-2 / Signup-delete-signup abuse

#### Codex verdict
Not fixed

#### What Claude did
No tombstone/cooldown/signup grant fix was observed.

#### What is still wrong
The delete route still hard-deletes the Supabase Auth user and no email-keyed tombstone, normalized email hash, signup rejection, or grant-suppression path exists.

#### Evidence
`app/api/account/delete/route.ts:132` still calls `serviceSupabase.auth.admin.deleteUser(user.id)`. No `deleted_emails`/tombstone migration or `handle_new_user` first-ever-email gate was found.

#### Security impact
Users can recreate the same email to regain welcome discount and free project access.

#### Safe remediation
Add a normalized-email tombstone on deletion and gate `handle_new_user` grants against it. Keep user-facing signup behavior unchanged except for the selected cooldown/admin-gated re-registration response.

### A-3 / `get_safe_profiles` leaks decrypted email

#### Codex verdict
Partially fixed

#### What Claude did
Added a migration to drop/recreate `get_safe_profiles(uuid[])` without `email`, and added an admin-only `/api/admin/users-with-emails` route for the notification sender.

#### What is still wrong
Runtime staging state could not be verified. Until the migration is applied and deployed callers are compatible, the old RPC may still leak email in staging/prod.

#### Evidence
`supabase/migrations/239_drop_email_from_get_safe_profiles.sql:21` returns only `id`, `username`, `avatar_url`, `role`. `app/api/admin/users-with-emails/route.ts` uses `verifyAdminRequest` and `get_decrypted_profiles`.

#### Security impact
If unapplied, any authenticated user can bulk-exfiltrate decrypted emails for known UUIDs.

#### Safe remediation
Apply migration 239, deploy the admin route/UI changes together, and verify:

```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname='get_safe_profiles';
```

### A-4 / Vulnerable Next.js version

#### Codex verdict
Not fixed

#### What Claude did
No dependency upgrade was observed.

#### What is still wrong
`next` remains on the vulnerable 14.x line cited by the guide.

#### Evidence
`package.json` contains `"next": "^14.2.35"`.

#### Security impact
Remote unauthenticated DoS advisories remain relevant.

#### Safe remediation
Plan and test a Next.js upgrade path, or add upstream rate limits/WAF coverage for affected RSC/image routes as an interim control.

### A-5 / `complete_keepz_payment` success-before-business-logic

#### Codex verdict
Not fixed

#### What Claude did
No RPC reorder migration was observed.

#### What is still wrong
The latest local definition still sets `keepz_payments.status='success'` before entering the nested `BEGIN ... EXCEPTION` business-logic block.

#### Evidence
`supabase/migrations/210_keepz_amount_based_accounting.sql:250` updates status and `callback_payload`; `:267` starts the nested block; `:265` explicitly documents that failures preserve success.

#### Security impact
A paid order can be marked success without enrollment/access/balance side effects, requiring manual recovery.

#### Safe remediation
Move the success update into the same exception-protected block as business effects, or use a separate processed state and a reconciliation job that cannot lose paid orders.

### A-6 / Project subscription and bundle approval races

#### Codex verdict
Not fixed

#### What Claude did
No race-fence migration was observed.

#### What is still wrong
`approve_project_subscription` updates by `id` only, then extends profile access. Manual bundle approval selects by `id`, credits the lecturer, and updates by `id` only.

#### Evidence
`supabase/migrations/108_approve_subscription_updates_profile.sql:35` lacks `AND status='pending'`. `supabase/migrations/178_platform_commission.sql:556` selects bundle request without status or `FOR UPDATE`; `:567` credits; `:570` updates by id.

#### Security impact
Admin double-clicks or concurrent calls can stack months or duplicate bundle side effects.

#### Safe remediation
Use `SELECT ... FOR UPDATE`, update with `AND status='pending'`, check row count, and add idempotency around lecturer credit.

### A-7 / Enrollment approve/reject TOCTOU

#### Codex verdict
Not fixed

#### What Claude did
No TOCTOU migration was observed.

#### What is still wrong
Approval selects pending without `FOR UPDATE`; the update has no pending fence. Rejection has the same pattern.

#### Evidence
`supabase/migrations/178_platform_commission.sql:489` selects pending; `:515` updates by id only after crediting at `:507`/`:511`. `supabase/migrations/040_update_reject_enrollment_request_to_remove_enrollment.sql:22` selects pending; `:31` updates by id only.

#### Security impact
Concurrent admin actions can double-credit lecturer balances or process inconsistent approve/reject outcomes.

#### Safe remediation
Lock pending rows and update with `AND status='pending'`; fail safely when row count is zero.

### A-8 / Other privileged `profiles` columns

#### Codex verdict
Partially fixed

#### What Claude did
Extended `protect_profiles_privileged_columns()` to block referral attribution and plaintext/encrypted PII columns for `authenticated`/`anon`.

#### What is still wrong
Runtime DB state was not verified. The migration also assumes service-role routes remain correct bypasses, leaving A-19 unresolved.

#### Evidence
`supabase/migrations/20260507104902_extend_protect_profiles_privileged_columns.sql:76` blocks `referral_code`; `:82` blocks `signup_referral_code`; `:88` blocks `referred_for_course_id`; `:97`, `:103`, `:109`, `:115`, `:121`, `:127` block PII columns.

#### Security impact
If unapplied, users can still mutate profile attribution/PII columns directly.

#### Safe remediation
Apply and verify trigger body plus column privileges. Keep service-role update routes pinned to explicit per-user rows.

### A-9 / Broad `submission_reviews` SELECT policy

#### Codex verdict
Not fixed

#### What Claude did
No policy removal migration was observed.

#### What is still wrong
The guide's broad live policy is not dropped by any new migration. Existing migrations also include a broad project-access review policy that allows any project-access user to view reviews.

#### Evidence
No migration contains `DROP POLICY IF EXISTS "Authenticated users can view submission reviews"`. `supabase/migrations/189_fix_project_access_anon_permission.sql:112` creates `"Project access users can view reviews"` with `has_project_access(auth.uid())`.

#### Security impact
Cross-cohort review/grade/payout visibility may remain.

#### Safe remediation
Drop the broad authenticated policy and review whether project-access users should see all reviews or only reviews tied to their own submissions/enrollments.

### A-10 / `process_signup_referral_on_enrollment` IDOR

#### Codex verdict
Partially fixed

#### What Claude did
Added an `auth.uid()` equality guard and revoked PUBLIC/anon execute for this RPC.

#### What is still wrong
Runtime staging state could not be verified. The function still grants `service_role`, but its guard rejects `auth.uid() IS NULL`; that is not a current source caller issue, but should be intentional.

#### Evidence
`supabase/migrations/240_guard_process_signup_referral.sql:41` raises `42501` when caller user does not match `p_user_id`. `app/api/enrollment-requests/route.ts` calls it through `createServerSupabaseClient(token)`.

#### Security impact
If unapplied, authenticated users can still pre-create referral rows for another user.

#### Safe remediation
Apply migration and verify grants/body in staging. Keep the application caller user-token scoped.

### A-11 / Manual bundle approval double-credit

#### Codex verdict
Not fixed

#### What Claude did
No manual-approval idempotency fix was observed.

#### What is still wrong
The manual bundle approval function credits the lecturer unconditionally before updating request status.

#### Evidence
`supabase/migrations/178_platform_commission.sql:567` calls `credit_user_balance(..., 'course_purchase', request_id::TEXT)` without a `balance_transactions` existence guard.

#### Security impact
Admin re-approval can duplicate lecturer credit for the same bundle request.

#### Safe remediation
Guard crediting by `(reference_id, source)` or reject manual approval when an associated Keepz payment is already successful.

### A-12 / Unsafe URL hostname allowlist

#### Codex verdict
Not fixed

#### What Claude did
No parser changes were observed.

#### What is still wrong
Both app and edge parser still use substring matching, so `tiktok.com.evil.com` and `instagram.com.evil.com` match.

#### Evidence
`lib/video-url-parser.ts:19`, `:31`, `:32`; `supabase/functions/view-scraper/index.ts:15`, `:16`.

#### Security impact
Spoofed platform URLs can pass validation/classification.

#### Safe remediation
Use exact/suffix host matching: `hostname === allowed || hostname.endsWith("." + allowed)` in both parsers.

### A-13 / Admin notification consent bypass

#### Codex verdict
Not fixed

#### What Claude did
No route-level transactional category control was observed.

#### What is still wrong
The route still trusts caller-provided `category`; transactional categories still bypass marketing consent.

#### Evidence
`app/api/admin/notifications/send/route.ts:72` defines transactional categories. `:350` reads category from request body. `:355` sets `effectiveRespectConsent = false` for those categories.

#### Security impact
Compromised or malicious admin can label marketing as transactional and email non-consenting users.

#### Safe remediation
Bind transactional categories to approved templates/events or require secondary approval for bulk consent override.

### A-14 / Login account enumeration

#### Codex verdict
Not fixed

#### What Claude did
No login error change was observed.

#### What is still wrong
Unconfirmed accounts still produce a distinct user-facing message.

#### Evidence
`lib/auth.ts:141` detects `Email not confirmed`; `:145` throws "Please verify your email address..." while invalid credentials throw a different message at `:150`.

#### Security impact
Attackers can distinguish unconfirmed existing accounts from invalid credentials.

#### Safe remediation
Return the same login error for unconfirmed and invalid credentials; keep verification hints in the resend-verification flow.

### A-15 / Keepz callback payload stores card context

#### Codex verdict
Not fixed

#### What Claude did
No payload scrubber was observed.

#### What is still wrong
The callback route still passes full `callbackData` into the RPC and stores full failed callback payloads.

#### Evidence
`app/api/payments/keepz/callback/route.ts:253` passes `p_callback_payload: callbackData`. `:352` stores failed `callback_payload: callbackData`. The RPC stores `p_callback_payload` at `supabase/migrations/210_keepz_amount_based_accounting.sql:252`.

#### Security impact
Card metadata/token context remains stored at rest in payment rows.

#### Safe remediation
Filter callback payload before persistence; never store `cardInfo` or token fields in `keepz_payments.callback_payload`.

### A-16 / Saved-card unique index is not user-scoped

#### Codex verdict
Not fixed

#### What Claude did
No saved-card index/upsert migration was observed.

#### What is still wrong
The unique index remains single-column and callback upsert conflict target remains `card_token`.

#### Evidence
`supabase/migrations/114_saved_cards.sql:20` creates `idx_saved_cards_token ON saved_cards(card_token)`. `app/api/payments/keepz/callback/route.ts:334` uses `onConflict: "card_token"`.

#### Security impact
If Keepz reuses tokens across users for the same physical card, a later user can clobber the earlier user's saved-card row.

#### Safe remediation
Audit existing duplicates, then migrate uniqueness to `(user_id, card_token)` and update upsert conflict target.

### A-17 / Migration prefix collisions

#### Codex verdict
Not fixed

#### What Claude did
Added one timestamp migration and three new sequential migrations (`239`, `240`, `241`). No historical collision cleanup was done.

#### What is still wrong
The 11 duplicate prefixes remain. The new sequential files do not collide now, but they ignore the repo's timestamp-only forward convention.

#### Evidence
`ls supabase/migrations | sort | awk -F_ '{print $1}' | uniq -d` returned `103,104,105,131,140,168,183,224,233,234,237`.

#### Security impact
Fresh environment/reset ordering remains drift-prone for security-relevant migrations.

#### Safe remediation
Do not rename already-applied migrations casually. For future fixes, use timestamped migrations only and verify deployment order with Supabase migration history.

### A-18 / Signed media URL routes lack rate limits

#### Codex verdict
Not fixed

#### What Claude did
No limiter was added to either route.

#### What is still wrong
Both routes authorize access, then create signed URLs without any `*.check(...)` rate-limit call.

#### Evidence
`app/api/chat-media/sign/route.ts:37` verifies auth and `:103` creates the signed URL; no limiter in between. `app/api/dm/media-url/route.ts:36` verifies auth and `:59` creates the signed URL; no limiter in between.

#### Security impact
Authorized users can flood signed URL generation and amplify storage/egress cost.

#### Safe remediation
Add a per-user limiter after auth and before storage signed URL creation.

### A-19 / `complete-profile` service-role profile update

#### Codex verdict
Not fixed

#### What Claude did
No blast-radius reduction was observed. The trigger migration explicitly relies on service-role bypasses remaining available.

#### What is still wrong
Profile completion still uses a service-role client for the update, including `profile_completed`, `lecturer_status`, and `is_approved` writes.

#### Evidence
`app/api/complete-profile/route.ts:42` creates `createServiceRoleClient(token)`. `:77` updates `profiles`.

#### Security impact
Current payload is whitelisted, but future payload drift would bypass RLS/trigger defenses.

#### Safe remediation
Use a user-scoped client for normal completion fields and isolate lecturer application fields into a narrow RPC or narrow service-role branch.

### A-20 / Withdrawal RPC lacks IBAN validation

#### Codex verdict
Not fixed

#### What Claude did
No DB-side validation was observed.

#### What is still wrong
The API route validates Georgian IBAN, but direct RPC calls still insert `p_bank_account_number` verbatim.

#### Evidence
`app/api/withdrawals/route.ts:108` validates format. `supabase/migrations/217_withdrawal_kyc_gate.sql:76` inserts `bank_account_number`; there is no regex check before insert.

#### Security impact
Direct PostgREST RPC callers can create malformed withdrawal requests.

#### Safe remediation
Add the same regex validation inside `create_withdrawal_request`.

### A-21 / Admin payments limiter and admin settings leak

#### Codex verdict
Not fixed

#### What Claude did
No route changes were observed for these endpoints.

#### What is still wrong
`admin/payments` does a manual admin check without shared `verifyAdminRequest`, so no `adminLimiter` runs. `admin/settings` GET remains available to any authenticated user and returns `updated_by`.

#### Evidence
`app/api/admin/payments/route.ts:23` and `:73` create service-role client/check admin with no limiter. `app/api/admin/settings/route.ts:23` documents any authenticated user can read; `:40` selects `updated_by`.

#### Security impact
Compromised admin tokens have less rate-limit pressure; students can learn admin UUIDs.

#### Safe remediation
Use `verifyAdminRequest` for admin payments. For settings GET, either require admin or strip `updated_by`/`updated_at` for non-admin callers.

### A-22 / RPC grants and referral/admin enumeration

#### Codex verdict
Partially fixed

#### What Claude did
Revoked anon execute on `check_is_admin` and PUBLIC/anon execute on referral-code generator helpers. Tightened response message text in referral validators and added a lower public endpoint rate limit.

#### What is still wrong
`has_project_access(uuid)` is intentionally left executable by anon. Both referral validation endpoints still return the boolean `valid`, so code existence enumeration remains, just with uniform message text and rate limiting.

#### Evidence
`supabase/migrations/241_revoke_anon_grants_security.sql:32` revokes `check_is_admin`; `:37`/`:38` revoke generator helper grants; `:46` explicitly keeps `has_project_access` anon behavior. `app/api/public/validate-referral-code/route.ts:73` returns `valid: !!profile`; authenticated route does the same at `app/api/validate-referral-code/route.ts:95`.

#### Security impact
Some admin/referral helper exposure is reduced, but referral-code enumeration and `has_project_access` probing are not closed.

#### Safe remediation
Remove standalone existence oracle behavior or only validate during signup submission. Rework RLS policies so `has_project_access` no longer needs anon execute, or accept/document that residual enumeration explicitly.

### A-23 / Health secret timing comparison

#### Codex verdict
Not fixed

#### What Claude did
No timing-safe comparison was added.

#### What is still wrong
The edge health function still compares the supplied secret with `!==`.

#### Evidence
`supabase/functions/health/index.ts:31`.

#### Security impact
Low practical risk, but the timing leak remains.

#### Safe remediation
Use a constant-time comparison helper over encoded byte arrays.

### A-24 / Sensitive realtime publication membership

#### Codex verdict
Not fixed

#### What Claude did
No publication cleanup migration was observed.

#### What is still wrong
No new migration drops `coming_soon_emails` or `email_send_history` from `supabase_realtime`.

#### Evidence
Search found adds to realtime in historical migrations, but no `ALTER PUBLICATION supabase_realtime DROP TABLE public.coming_soon_emails, public.email_send_history`.

#### Security impact
Latent PII/event leak risk remains if future RLS changes relax access.

#### Safe remediation
Drop unused sensitive tables from realtime publication and verify no client subscribes to them.

### A-25 / Account deletion withdrawal anonymization

#### Codex verdict
Not fixed

#### What Claude did
No withdrawal anonymization was added.

#### What is still wrong
The deletion route anonymizes `payment_audit_log` and `keepz_payments`, but not `withdrawal_requests`.

#### Evidence
`app/api/account/delete/route.ts:79` updates `payment_audit_log`; `:95` updates `keepz_payments`; no `withdrawal_requests` update exists before auth deletion at `:132`.

#### Security impact
Withdrawal rows may retain orphaned deleted-user IDs and residual personal linkage.

#### Safe remediation
Make `withdrawal_requests.user_id` nullable if needed, then set it to null during account deletion.

### A-26 / Email domain typo

#### Codex verdict
Not fixed

#### What Claude did
No email template domain fix was observed.

#### What is still wrong
Both app email templates and edge shared email templates still point to `wavleba.ge`.

#### Evidence
`lib/email-templates.ts:44` and `supabase/functions/_shared/email.ts:38` set `SITE_URL = "https://wavleba.ge"`. Visible footer text remains `wavleba.ge` at `lib/email-templates.ts:61` and edge shared email `:55`.

#### Security impact
Real platform emails can link users to a typo domain if it becomes attacker-controlled.

#### Safe remediation
Change to canonical `https://swavleba.ge` or a shared app URL env var, and update visible footer text.

## New Vulnerabilities Introduced by Claude

No new validated vulnerabilities introduced by Claude were found.

Notes:

- The new admin users-with-emails route exposes decrypted email by design, but it uses `verifyAdminRequest`, rate limiting, service-role access, and audit logging. I did not validate a bypass.
- Migration 241 intentionally leaves anon `has_project_access` callable. This is an incomplete fix to A-22, not a newly introduced vulnerability.

## Behavior / UI Regression Risks

- `get_safe_profiles` return-shape change must be deployed with all callers. Source callers I inspected use username/avatar/role, and `AdminNotificationSender` was moved to an admin route, but deployed edge functions must match the new RPC shape.
- `process_signup_referral_on_enrollment` now rejects calls where `auth.uid()` is null. Current source uses a user-token client, but any service-role maintenance caller would break.
- The new trigger migration blocks direct user-token updates to `profile_completed` and bank/PII fields. Current `complete-profile` and `balance` routes use service role, so UI likely still works, but this should be manually staged.

## Tests and Commands Run

- `git branch --show-current && git rev-parse --short HEAD && git status --short` - success; branch `deps/security-fixes-staging`, commit `92d1362`, dirty worktree.
- `git status` - success; listed modified tracked files and untracked migrations/docs.
- `git diff --name-status` and `git ls-files --others --exclude-standard` - success.
- `rg`/`sed`/`nl` inspections across `final_security_guide.md`, `app/api`, `lib`, `supabase/functions`, and `supabase/migrations` - success.
- `npm run lint` - did not complete; Next.js prompted interactive ESLint setup because no lint config is configured.
- `npx tsc --noEmit` - success.
- `npm run build` - success. Build emitted existing runtime warnings about missing Upstash Redis env and a Next dynamic route warning during static page generation, but exited 0.
- `psql --version` - failed; `psql` is not installed.
- `supabase db query "select current_database()..." --db-url <staging>` - failed due DNS/IPv6 routing.
- Same staging query retried with escalated network permission - failed with IPv6 `no route to host`. No staging SQL was executed.
- `supabase db query "select 1" --linked` - failed because local Supabase CLI linkage points at a different project ref (`ablvormhhqcjuoczlzng`), not staging.

## Manual Staging Checks Needed

Run these against staging `bvptqdmhuumjbyfnjxdt` before any production decision:

```sql
-- Profiles trigger body includes A-1/A-8 columns
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname='protect_profiles_privileged_columns'
AND pronamespace='public'::regnamespace;

-- get_safe_profiles no longer returns email
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname='get_safe_profiles'
AND pronamespace='public'::regnamespace;

-- RPC grants
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema='public'
AND routine_name IN (
  'check_is_admin',
  'has_project_access',
  'auto_generate_referral_code',
  'generate_referral_code',
  'process_signup_referral_on_enrollment'
)
ORDER BY routine_name, grantee;

-- submission_reviews policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public'
AND tablename='submission_reviews'
ORDER BY policyname;

-- payment and approval RPC bodies
SELECT proname, pg_get_functiondef(oid)
FROM pg_proc
WHERE pronamespace='public'::regnamespace
AND proname IN (
  'complete_keepz_payment',
  'approve_project_subscription',
  'approve_bundle_enrollment_request',
  'approve_enrollment_request',
  'reject_enrollment_request',
  'create_withdrawal_request'
);

-- realtime publication membership
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname='supabase_realtime'
AND tablename IN ('coming_soon_emails', 'email_send_history', 'submission_reviews');

-- saved card uniqueness
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname='public'
AND tablename='saved_cards';
```

Manual flow checks:

- Authenticated user cannot PATCH `welcome_discount_expires_at`, referral columns, plaintext PII, or encrypted PII through PostgREST.
- Normal profile completion still succeeds for student and lecturer intent.
- `/api/balance` PATCH still saves a valid Georgian IBAN for the caller only.
- Admin notification specific-user picker still loads emails through `/api/admin/users-with-emails`.
- Keepz success callback with `cardInfo` does not persist card details after A-15 is fixed.
- Admin double-click/concurrent approval tests for enrollment, bundle, and project subscription return safe already-processed errors after A-6/A-7/A-11 are fixed.

## Final Recommendation

Not safe yet - fix listed blockers first.
