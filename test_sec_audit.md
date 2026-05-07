# Swavleba (MainCourse) — Security Audit (2026-05-07)

**Scope.** Read-only review of branch `deps/security-fixes-staging` (commit
`dc8c250`) against staging Supabase project `bvptqdmhuumjbyfnjxdt` (verified
via `mcp__supabase__get_project_url` →
`https://bvptqdmhuumjbyfnjxdt.supabase.co`). Stack: Next.js 14.2.35 App
Router, TypeScript 5.3, Supabase (auth/DB/realtime/edge), Resend, Keepz
payments, Upstash Ratelimit. Surface area: 75 `app/api/route.ts`, 28 edge
functions, 231 migrations, 7 storage buckets.

**Method.** (1) Static reading of auth/payments/PII/realtime/admin
helpers and routes; (2) parallel SQL inventory on staging
(`pg_tables.rowsecurity`, `pg_policies`, `pg_proc` for SECURITY DEFINER
bodies, column-level `information_schema.column_privileges`,
`storage.buckets`, `pg_publication_tables`, `mcp__supabase__get_advisors`);
(3) `npm audit --omit=dev` for dependency posture; (4) regex sweeps for
hardcoded secrets, `dangerouslySetInnerHTML`, `eval(`, `"use server"`,
`SECURITY DEFINER`/`DISABLE RLS`/grants in migrations.

**Headline.** No Critical findings. The recent "security audit bundle"
(commits `39c2992`, `c1025a0`, `4a95939`, `cf0d0d2`) closed the obvious
escalation paths: a `protect_profiles_role` trigger now blocks
self-promotion, a `protect_profiles_privileged_columns` trigger covers
balance/is_approved/lecturer_status/project_access_expires_at/
can_create_free_projects/profile_completed, all 45 public tables have
RLS enabled, all SECURITY DEFINER functions set `search_path`, sensitive
storage buckets are private, and payment + withdrawal RPCs use
`FOR UPDATE` row locks. The biggest residual risks are **(a)** an
authenticated cross-user email harvester via
`get_safe_profiles(uuid[])` returning decrypted email — explicitly noted
as an open follow-up in migration 237's comment; **(b)** an outdated
`next@14.2.35` carrying five npm advisories including a high-severity
HTTP request deserialization DoS; and **(c)** hostname allowlists in
the video-URL parser that match by `String.includes`, letting
`tiktok.com.evil.com` pass.

## Top risks

1. **HIGH** `get_safe_profiles(uuid[])` returns decrypted `email` to any
   authenticated caller for any UUID array — bulk PII harvesting. (SEC-001)
2. **HIGH** `next@14.2.35` has 5 active advisories (1 High CVE: request
   deserialization DoS); upgrade is semver-major. (SEC-002)
3. **HIGH** `lib/video-url-parser.ts:21` and
   `supabase/functions/view-scraper/index.ts:14` use
   `hostname.includes("tiktok.com")` — host bypass via
   `tiktok.com.evil.com`. (SEC-003)
4. **MED** `process_signup_referral_on_enrollment(p_user_id, …)` is granted
   to `authenticated` and never checks `p_user_id == auth.uid()` — IDOR
   write-on-behalf-of-user. (SEC-004)
5. **MED** `profiles.referral_code` is user-writable via PostgREST (no
   protection trigger; `auto_generate_referral_code` only fires on NULL),
   letting users set their own custom code. (SEC-005)

## §0 Conventions

- "Verified" = SQL run on staging and result inspected, or file
  `Read`-and-line-cited.
- "Inferred" = derived from pattern across sampled routes; where I did
  not open the file, I say so.
- All SQL was `SELECT` / `pg_get_functiondef` only. No writes.
- No JWTs / RSA blocks / API keys / live PII appear in this report (a
  regex sweep for `eyJ[A-Za-z0-9_-]{30,}|sk_(live|test)_[A-Za-z0-9]{10,}|-----BEGIN|password=|@(?:gmail|yahoo|outlook|hotmail)\.` after writing returned 0 hits — see Phase F).
- File:line citations are against the working tree at HEAD = `dc8c250`.

## §1 Critical findings

**None found.** The candidate Critical issues — role escalation via
PostgREST PATCH, RLS bypass on financial tables, payment theft via
callback spoof, mass-PII leak via `decrypt_pii` — are all closed by
triggers, RLS posture, encrypted-payload requirement on Keepz callbacks,
and the `decrypt_pii` REVOKE in migration 233. Verification is in §10.

## §2 High findings

```
ID: SEC-001
Severity: High
Category: pii / authz
Location: pg function public.get_safe_profiles(user_ids uuid[]) — verified via
          pg_get_functiondef(oid); migration 237_profiles_drop_broad_read_policies.sql
          comment: "(+email — tracked as a follow-up; not addressed here)"
Description: SECURITY DEFINER function get_safe_profiles returns
  RETURNS TABLE(id uuid, username text, email text, avatar_url text, role text)
  where `email` is COALESCE(decrypt_pii(p.encrypted_email), p.email).
  EXECUTE is granted to `authenticated` and `service_role`
  (information_schema.routine_privileges). The function applies no caller
  scope: it returns rows for every UUID the caller passes in p_user_ids.
Impact: Any authenticated user can call POST /rest/v1/rpc/get_safe_profiles
  with a list of any user UUIDs and receive their decrypted emails. UUIDs
  are not enumerable in bulk, but they are visible across the app
  (chat messages, project submissions, course-enrollment lists,
  search_friend_candidates results, message_reactions). An attacker who
  has been a member of a single course or DM can exfiltrate every
  participant's email. This breaks the fail-closed PII posture set up by
  migrations 174/175/233.
Reproduction:
  SELECT routine_name, grantee, privilege_type
    FROM information_schema.routine_privileges
   WHERE routine_schema='public' AND routine_name='get_safe_profiles';
  -- → grantee {authenticated, service_role}
  Then a logged-in user calls /rest/v1/rpc/get_safe_profiles
  with body {"user_ids": ["<known UUID>"]} and receives the email back.
Recommendation: Either (a) drop `email` from the RETURNS TABLE and route
  email lookups through the existing get_decrypted_profiles RPC which is
  service_role-only, or (b) gate the function body on a relationship
  predicate (caller is admin OR caller shares a friendship/enrollment/DM
  with each requested UUID), or (c) revoke EXECUTE from authenticated and
  expose it only via server routes that already authorize. Migration 237
  acknowledged this as a follow-up.
References: CWE-200 (Information Exposure), OWASP A01:2021 (Broken Access
  Control). https://supabase.com/docs/guides/database/postgres/row-level-security
```

```
ID: SEC-002
Severity: High
Category: dependency
Location: package.json:38 (`"next": "^14.2.35"`); npm audit --omit=dev
Description: Five active advisories on `next@14.2.35`:
  - GHSA-h25m-26qc-wcjf High (CWE-400/502, CVSS 7.5): HTTP request
    deserialization DoS via insecure React Server Components.
  - GHSA-q4gf-8mx6-v5v3 High (CWE-770, CVSS 7.5): DoS with Server
    Components.
  - GHSA-9g9p-9gw9-jx7f Moderate (CWE-400/770, CVSS 5.9): Image Optimizer
    DoS via remotePatterns config.
  - GHSA-ggv3-7p47-pfv8 Moderate (CWE-444): HTTP request smuggling in
    rewrites.
  - GHSA-3x4c-7xq6-9pq8 Moderate (CWE-400): Unbounded next/image disk
    cache growth.
  Plus transitive: postcss <8.5.10 GHSA-qx2v-qp2m-jg93 Moderate XSS via
  unescaped `</style>` in CSS Stringify Output.
Impact: All five Next.js findings are availability — a remote attacker
  can exhaust CPU, memory, or disk on the running pod. swavleba.ge is
  live in production (CLAUDE.md). The PostCSS XSS requires user-controlled
  CSS through postcss serialization; not exploitable in this codebase
  but resolves with the Next upgrade.
Reproduction: `npm audit --omit=dev --json` (Appendix B). The fix path
  per `npm audit fix` is `next@16.2.5` (semver-major).
Recommendation: Plan a Next 14 → 15 → 16 upgrade window with
  regression testing of App Router + middleware CSP nonce flow + edge
  fn cold starts. As an interim, behind DigitalOcean's reverse proxy
  consider an upstream rate limit / WAF rule on the affected paths
  (image optimizer, RSC handler).
References: GHSA URLs above; Next.js security policy
  https://nextjs.org/docs/messages/security
```

```
ID: SEC-003
Severity: High (downgraded to Medium if no user-controlled URL ever
          enters these helpers — see Reproduction)
Category: misconfig / business-logic / ssrf-adjacent
Location: lib/video-url-parser.ts:13-22 (validatePlatformUrl,
          detectPlatform) and supabase/functions/view-scraper/index.ts:14
          (inline detectPlatform)
Description: Both `detectPlatform` implementations classify a URL by
    hostname.includes("tiktok.com")
    hostname.includes("instagram.com")
  An attacker-controlled hostname like `tiktok.com.evil.com` or
  `evil.tiktok.com.attacker.io` matches. validatePlatformUrl uses the
  same .includes test against an allowlist, so a "tiktok" submission
  whose video_url is `https://tiktok.com.evil.com/x` passes
  validatePlatformUrl and is treated as a TikTok URL by the scraper.
Impact: The scraper hands the URL to Apify (an external service) — the
  immediate target is Apify, not internal infrastructure, so traditional
  SSRF (probing 169.254.169.254, internal services) is mitigated by the
  external dispatch. The practical impact is platform misclassification
  + view-count fraud against the project payout calculation: a student
  could submit a non-TikTok URL that masquerades as TikTok and have it
  routed through TikTok-specific scraping. If Apify ever returns
  attacker-controlled view counts, that translates into payouts via
  pay_submission. There is also a phishing surface: video URLs are
  rendered as clickable links elsewhere in the UI.
Reproduction:
  > new URL("https://tiktok.com.evil.com/x").hostname.includes("tiktok.com")
  // true
  > new URL("https://tiktok.com.evil.com/x").hostname.endsWith(".tiktok.com")
  // false  ← the safe check
  Trace where extractVideoUrls() is called from (project_submissions
  ingestion) to confirm whether the URL is user-controlled at write time.
Recommendation: Replace .includes with strict suffix match:
  `hostname === allowed || hostname.endsWith("." + allowed)`. Apply in
  both lib/video-url-parser.ts and supabase/functions/view-scraper.
References: CWE-1023 (Incomplete Comparison with Missing Factors),
  https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
```

## §3 Medium findings

```
ID: SEC-004
Severity: Medium
Category: authz / business-logic
Location: pg function public.process_signup_referral_on_enrollment(
          p_user_id uuid, p_enrollment_request_id uuid, p_course_id uuid)
          (verified via pg_get_functiondef); GRANT EXECUTE TO authenticated.
Description: SECURITY DEFINER, granted to authenticated, but the body
  never checks `p_user_id = auth.uid()`. Any logged-in user can call
  POST /rest/v1/rpc/process_signup_referral_on_enrollment with arbitrary
  (p_user_id, p_enrollment_request_id, p_course_id) and create a row in
  public.referrals attributing the referral to whatever signup_referral_code
  happens to live on p_user_id's profile.
Impact: Limited financial exposure because the credit logic is driven
  off the *target user's* signup_referral_code (which the attacker can't
  set on someone else's profile — `protect_profiles_role` does not cover
  signup_referral_code, but that column lives behind RLS row-scope).
  However, the attacker can pre-create referral rows that block legitimate
  process_signup_referral_on_enrollment runs (the row's UNIQUE
  (referred_user_id, enrollment_request_id) fires DO NOTHING), denying a
  referrer their commission. Also breaks the invariant "this RPC is
  triggered by the user it acts on."
Reproduction: Call /rest/v1/rpc/process_signup_referral_on_enrollment as
  user A with body
    {"p_user_id":"<UUID of victim B>", "p_enrollment_request_id":"<B's pending request>",
     "p_course_id":"<UUID>"}
  → row inserted on B's behalf.
Recommendation: Add `IF p_user_id <> auth.uid() THEN RAISE EXCEPTION
  'Access denied'; END IF;` at the top, mirroring process_referral
  (which already does this).
References: CWE-639 (Authorization Bypass Through User-Controlled Key).
```

```
ID: SEC-005
Severity: Medium
Category: business-logic
Location: trigger public.auto_generate_referral_code (fires only when
          NEW.referral_code IS NULL); column-level grant
          information_schema.column_privileges → role=`authenticated`,
          column=`referral_code`, privilege=UPDATE.
Description: `profiles.referral_code` has no protection trigger: 218's
  privileged-column trigger does not list it, and protect_profiles_role
  only covers `role`. The auto-generation trigger only fires when the
  value is NULL. Combined with the RLS UPDATE policy "Users can update
  own profile" (no WITH CHECK, no column scoping) and the column-level
  GRANT UPDATE on referral_code to `authenticated`, a user can PATCH
  /rest/v1/profiles?id=eq.<self> with `{"referral_code":"BRAND123"}` and
  set any unique 1–20-char string.
Impact: A user can claim a memorable referral code (vanity / squatting
  / impersonation of a brand or another lecturer's intended code), and
  in adversarial cases coordinate with offline marketing to harvest
  referral attribution that wasn't theirs by default. The unique index
  on referral_code prevents collision, so only first-mover gets each
  code. Not a direct theft path because referral commission still flows
  to the *referrer*, but it lets a user impersonate another's brand.
Reproduction:
  SELECT column_name, privilege_type, grantee
    FROM information_schema.column_privileges
   WHERE table_schema='public' AND table_name='profiles'
     AND column_name='referral_code' AND grantee='authenticated';
  -- → UPDATE present
  Then PATCH the row over PostgREST.
Recommendation: Add `referral_code` to the
  protect_profiles_privileged_columns() trigger (or a new dedicated
  trigger) — block NEW.referral_code IS DISTINCT FROM OLD.referral_code
  when current_user is `authenticated`/`anon`. Auto-generation continues
  to fire for new INSERTs (NEW.referral_code IS NULL), and admin /
  service-role flows are unaffected.
References: CWE-732 (Incorrect Permission Assignment for Critical Resource).
```

```
ID: SEC-006
Severity: Medium
Category: pii / authz
Location: pg policy "Authenticated users can view submission reviews"
          on public.submission_reviews (verified in pg_policies); coexists
          with the more-restrictive "Users can view reviews in enrolled
          courses" (broader policy wins under PERMISSIVE OR semantics).
Description: Any authenticated user — including students of one course
  — can SELECT every row in submission_reviews across the platform,
  including grades, payout amounts, lecturer comments, and the IDs of
  the reviewing lecturer and reviewed student.
Impact: Cross-cohort grade visibility and lecturer-payout transparency.
  Lecturer payout amounts (set by admins via pay_submission) become
  visible to all signed-in users, which may not match policy intent.
Reproduction:
  SELECT policyname, qual FROM pg_policies
   WHERE schemaname='public' AND tablename='submission_reviews'
     AND cmd='SELECT';
  → "Authenticated users can view submission reviews" qual:
    `(SELECT auth.uid() AS uid) IS NOT NULL`
Recommendation: Drop the broad policy if it is a leftover from earlier
  development; the narrower "Users can view reviews in enrolled courses"
  + "Lecturers can update reviews" set is sufficient. Add an admin SELECT
  policy if absent.
References: CWE-200, OWASP A01:2021.
```

```
ID: SEC-007
Severity: Medium
Category: misconfig / authz
Location: app/api/complete-profile/route.ts:42 (`createServiceRoleClient(token)`)
Description: The route uses a service-role client for the profile UPDATE,
  which bypasses every PostgREST trigger that defends privileged columns
  — protect_profiles_role, protect_profiles_privileged_columns,
  protect_profiles_kyc_status. The current updatePayload is whitelisted
  (`username, profile_completed, terms_accepted, terms_accepted_at,
  marketing_emails_consent, marketing_emails_consent_at`, plus
  `lecturer_status`/`is_approved` for the lecturer flag), so today no
  privileged column is written. The defense relies entirely on a future
  contributor not adding `role` (or any other privileged column) to the
  payload.
Impact: Brittle defense. A typo or misuse here would let an attacker who
  controls the `complete-profile` body escalate by setting `role=admin`
  or `balance=999999`, since the service-role bypasses the triggers that
  would otherwise stop them.
Reproduction: Static analysis only. Read the route and confirm the
  service-role client is used for an UPDATE on `profiles` (line 77).
Recommendation: Use the user-scoped `createServerSupabaseClient(token)`
  for the UPDATE. RLS allows authenticated users to UPDATE their own
  profile row; the privileged-column triggers will then catch any future
  drift. Use service role only if/when a privileged write is genuinely
  required, and gate it explicitly.
References: CWE-269 (Improper Privilege Management), defense-in-depth.
```

```
ID: SEC-008
Severity: Medium
Category: business-logic
Location: pg function public.create_withdrawal_request(p_amount,
          p_bank_account_number) (verified via pg_get_functiondef);
          callable directly via /rest/v1/rpc/create_withdrawal_request.
Description: The RPC enforces auth, KYC gate, no-pending-duplicate,
  and pre-debits the user's balance via debit_user_balance (which itself
  checks sufficient balance and FOR UPDATEs the row — good). But it does
  no IBAN format validation: `p_bank_account_number` is inserted verbatim.
  The Georgian-IBAN regex `^GE[0-9]{2}[A-Z]{2}[0-9]{16}$` lives only in
  app/api/withdrawals/route.ts:108 — a direct PostgREST call bypasses
  it and stores any string ≤ column length.
Impact: A user calling the RPC directly can submit a junk bank account
  number (e.g. attacker note). Funds are still held against their
  balance, an admin then approves it (or rejects on bank rejection) and
  needs to chase. Not a theft path — the receiver is set by the user
  themselves — but it lets a malicious user wedge admin workflow.
Reproduction: As an authenticated user with positive balance + verified
  KYC: POST /rest/v1/rpc/create_withdrawal_request body
    {"p_amount": 50, "p_bank_account_number": "<not-a-Georgian-IBAN>"}
Recommendation: Add the same IBAN regex check inside the RPC body
  (RAISE EXCEPTION on mismatch), so both API and RPC enforce it.
References: defense-in-depth.
```

```
ID: SEC-009
Severity: Medium
Category: business-logic
Location: pg function public.approve_bundle_enrollment_request(request_id uuid)
          (1-arg variant; verified via pg_get_functiondef) vs.
          public.complete_keepz_payment for payment_type='bundle_enrollment'.
Description: The 1-arg manual-approval RPC for bundle enrollments calls
  credit_user_balance(lecturer, price - 3% commission) without checking
  whether complete_keepz_payment has already credited the lecturer for
  this same request_id. complete_keepz_payment uses
  `bundle_enrollment_request.id` as the reference_id and credits
  `amount - keepz_fee - 3%`. If an admin invokes the manual approval
  RPC for a request that was also paid via Keepz (e.g. recovery of a
  stuck payment), the lecturer is double-credited.
Impact: One-off duplicate credit equal to the bundle price minus 3%,
  payable to the lecturer. The credit is logged in balance_transactions
  so it's auditable but not auto-detected.
Reproduction: Compare ON CONFLICT / idempotency in the two functions.
  approve_bundle_enrollment_request has no balance_transactions
  pre-check; complete_keepz_payment uses
  `NOT EXISTS (SELECT 1 FROM balance_transactions WHERE reference_id=…
   AND source IN ('course_purchase'))` for its idempotent recovery branch.
Recommendation: Either (a) wire the same `NOT EXISTS balance_transactions
  WHERE reference_id=v_request_id AND source='course_purchase'` guard
  into approve_bundle_enrollment_request, or (b) require the manual RPC
  to refuse when keepz_payments already has a status='success' row for
  this reference_id.
References: CWE-841 (Improper Enforcement of Behavioral Workflow).
```

```
ID: SEC-010
Severity: Medium
Category: rate-limit / business-logic
Location: app/api/admin/notifications/send/route.ts:341-346, 462
Description: `category` is read straight from the request body. Marketing
  consent is bypassed when category ∈ {transactional_security,
  transactional_terms, transactional_account}. Any admin can therefore
  bulk-email all profiles (target_type='all') by labelling the message
  as "transactional_security", even if the content is marketing. The
  audit log records `override_consent: true`, so it is detectable
  post-hoc, but there is no second human gate.
Impact: An admin (or an attacker with admin credentials) can send mass
  email to every user regardless of marketing consent. Compliance impact
  in EU/Georgia (GDPR-equivalent) for unsolicited marketing.
Reproduction: Static — read the resolveEmails call site at line 540.
Recommendation: Either (a) restrict the consent override to a separate
  RPC requiring two-admin approval, or (b) require structured proof
  (e.g. only allow `transactional_security` for messages whose body
  matches a pre-registered template / event), or (c) add a per-day cap
  on bulk emails sent under override_consent and surface a banner in
  the admin UI.
References: GDPR Art. 6/7 (lawful basis for processing).
```

```
ID: SEC-011
Severity: Medium
Category: rate-limit
Location: app/api/chat-media/sign/route.ts (no rate limiter), app/api/dm/media-url/route.ts
          (no rate limiter), app/api/courses/[courseId]/video-url/route.ts
          (generalLimiter — 30/min by IP)
Description: chat-media/sign and dm/media-url have no `paymentLimiter`/
  `generalLimiter`/`writeLimiter` wrapper. They auth and check
  enrollment/participation before signing, so unauthorized download is
  blocked, but an enrolled attacker can spin up arbitrary signed-URL
  generation and use those URLs to share media outside the platform.
Impact: Cost amplification (signed-URL generation against Storage) and
  enabled bulk-mirroring of course chat / DM media.
Recommendation: Wrap both routes with `generalLimiter.check(getClientIP)`
  or `notificationLimiter.check(user.id)` (60/min) — same pattern as
  app/api/notifications/route.ts:25.
References: CWE-770 (Allocation of Resources Without Limits).
```

```
ID: SEC-012
Severity: Medium
Category: misconfig
Location: supabase/migrations/{224_add_channels_to_realtime.sql,
          224_privatize_dm_media.sql}, similar pairs at 233/234/237
Description: Multiple migration files share the same numeric prefix:
  224×2, 233×2 (`233_decrypt_pii_fail_closed.sql` +
  `233_restore_search_path_pg_temp.sql`), 234×2, 237×2. CLAUDE.md
  explicitly warns "Do not hand-prefix sequential numbers — see
  docs/supabase-guide.md" and recommends the `supabase migration new`
  timestamp form.
Impact: On a fresh `supabase db reset` or a new environment, the apply
  order between same-prefix files depends on filesystem sort, which is
  locale-dependent. Two of the colliding 233/237 migrations carry
  security-relevant changes (`decrypt_pii_fail_closed` and
  `profiles_drop_broad_read_policies`); a wrong apply order could leave
  the schema in an inconsistent state.
Reproduction: `ls supabase/migrations | sort` and inspect the same-prefix
  pairs.
Recommendation: Rename the duplicates to monotonic prefixes (or migrate
  to timestamped names per CLAUDE.md) and verify via `supabase migration
  list` against staging that the production deploy order matches what
  the new names imply.
References: project-internal CLAUDE.md.
```

## §4 Low findings

```
ID: SEC-013
Severity: Low
Category: secrets / info-leak
Location: pg function public.check_is_admin(user_id uuid) — verified;
          GRANT EXECUTE TO anon (migration 194_fix_check_is_admin_anon_permission.sql)
Description: Anon can call /rest/v1/rpc/check_is_admin?user_id=<uuid>
  and learn whether that UUID is an admin. Same for has_project_access.
  Practical exploitation requires knowing UUIDs, which are not
  enumerable, but anyone who has interacted with an admin (a chat
  message, a notification, an enrollment review) sees their UUID.
Impact: Admin enumeration / target identification for follow-on social
  engineering or credential-stuffing prioritization.
Recommendation: Move the anon use case (the legacy referral-code-check
  flow that needed it) behind a server route, REVOKE EXECUTE FROM anon,
  and re-grant only to authenticated. Same for has_project_access.
References: CWE-203 (Observable Discrepancy).
```

```
ID: SEC-014
Severity: Low
Category: rate-limit
Location: app/api/account/delete/route.ts:28 (accountLimiter by IP),
          app/api/balance/route.ts:90 (accountLimiter by IP),
          app/api/profile/route.ts:67 (accountLimiter by IP),
          app/api/payments/saved-cards/route.ts:28,82
Description: Account-impacting routes rate-limit by IP via getClientIP,
  not by user.id. NAT'd users (corporate office, public Wi-Fi) share an
  IP and can therefore lock each other out of account deletion / saved
  card deletion / IBAN updates by burning the limiter (5/min).
Impact: Cross-tenant denial of legitimate account changes.
Recommendation: For these specific routes, use `accountLimiter.check(user.id)`
  after auth — same pattern adminLimiter uses elsewhere
  (lib/admin-auth.ts:52).
References: CWE-770.
```

```
ID: SEC-015
Severity: Low
Category: logging
Location: lib/audit-log.ts:33; app/api/admin/withdrawals/route.ts:37-42;
          app/api/admin/notifications/send/route.ts:461-471
Description: console.log calls embed admin user IDs and target IDs at
  INFO level, plus internal request shapes (e.g. SUPABASE_SERVICE_ROLE_KEY
  *presence* boolean is logged). No actual secrets are logged — verified
  via `grep -RIlnE 'eyJ[A-Za-z0-9_-]{30,}|sk_(live|test)_|-----BEGIN'`
  → 0 hits across `app lib components scripts supabase/functions`. But
  if production logs are exfiltrated, the IDs aid attribution.
Recommendation: Demote these to debug level; use the existing
  audit_log table for retained records.
References: CWE-532 (Insertion of Sensitive Information into Log File).
```

```
ID: SEC-016
Severity: Low
Category: misconfig
Location: lib/email-templates.ts:44 (`const SITE_URL = "https://wavleba.ge";`)
Description: Typo — should be `swavleba.ge`. Affects `Browse Courses`
  and footer links in transactional emails. Not a security issue per
  se, but `wavleba.ge` is an unregistered domain (verify before any
  fix); if registered by an adversary it becomes a phishing redirect
  target embedded in genuine Swavleba emails.
Recommendation: Fix the typo. After fix, also defend by setting
  SITE_URL from `process.env.NEXT_PUBLIC_APP_URL`.
References: CWE-451 (User Interface (UI) Misrepresentation), defense.
```

```
ID: SEC-017
Severity: Low
Category: business-logic
Location: app/api/admin/withdrawals/[requestId]/approve/route.ts:101,
          app/api/admin/kyc/[submissionId]/approve/route.ts:76,
          app/api/admin/lecturer-approvals/[id]/approve/route.ts (same pattern)
Description: Each route reads the row's status before the RPC and
  branches on `status === 'pending'`. The RPCs themselves use
  `WHERE id = … AND status = 'pending' FOR UPDATE` so DB-level
  atomicity holds. The pre-RPC check is purely cosmetic (better error
  messaging) but introduces a TOCTOU window where two concurrent admins
  could both pass the JS check, with one then failing at the RPC and
  surfacing a generic error.
Recommendation: Drop the pre-check and rely on the RPC's row-lock,
  surfacing the RPC's "not found or already processed" message back
  to the UI.
References: CWE-367 (TOCTOU).
```

```
ID: SEC-018
Severity: Low
Category: misconfig
Location: middleware.ts:38 (CSP `style-src 'self' 'unsafe-inline'`)
Description: `style-src 'unsafe-inline'` is an accepted Tailwind
  trade-off documented in the file. Note: with `unsafe-inline` for
  styles, a CSS-injection vector via `dangerouslySetInnerHTML` content
  could carry styling that exfiltrates via attribute selectors (rare).
  Script-src is nonce-based and prod-strips `unsafe-eval`. Generally
  acceptable; flagging for awareness.
Recommendation: Track the Tailwind-with-nonce migration the comment
  references. No urgent change.
References: CSP best practices, https://content-security-policy.com/.
```

## §5 Informational / hardening

- **POSITIVE-A**: All 45 public tables have RLS enabled (`pg_tables.rowsecurity`
  query — every row returned `true`).
- **POSITIVE-B**: All 60+ SECURITY DEFINER functions in `public` set
  `search_path` (verified via `pg_proc.proconfig`) — no
  function-hijacking surface via search-path manipulation.
- **POSITIVE-C**: `decrypt_pii(TEXT)` is REVOKEd from
  `PUBLIC, anon, authenticated, service_role` (migration 233 +
  re-checked at routine_privileges) — only callable inside a
  SECURITY DEFINER chain owned by `postgres`.
- **POSITIVE-D**: `protect_profiles_role` trigger (BEFORE UPDATE on
  profiles) blocks role escalation from `authenticated`/`anon`.
  Verified by reading trigger body.
- **POSITIVE-E**: `protect_profiles_privileged_columns` trigger
  (migration 218) covers balance / is_approved / lecturer_status /
  project_access_expires_at / can_create_free_projects /
  profile_completed.
- **POSITIVE-F**: `protect_profiles_kyc_status` trigger uses
  `pg_trigger_depth() = 1` to allow nested writes from
  `sync_profile_kyc_status` while blocking direct user PATCHes.
- **POSITIVE-G**: `complete_keepz_payment`, `approve_withdrawal_request`,
  `debit_user_balance`, `credit_user_balance` all use `FOR UPDATE` row
  locks. `debit_user_balance` checks `balance < amount` and raises.
- **POSITIVE-H**: `app/api/payments/keepz/callback/route.ts:90` rejects
  plaintext payloads and requires `encryptedData`/`encryptedKeys`;
  `decryptCallback` uses RSA-OAEP-decrypted AES-CBC; amount-equality
  check at line 227; comprehensive `payment_audit_log` insert on every
  branch; always returns `200` per Keepz's retry semantics.
- **POSITIVE-I**: `lib/auth.ts:67` strips `role` from signup metadata
  conceptually (handle_new_user hardcodes role='student' — migration 172).
- **POSITIVE-J**: KYC submission path validator (app/api/kyc/submit/route.ts:26-53):
  blocks `\`, `%`, leading `/`, traversal, requires UUID-rooted folder
  matching auth.uid(); RPC re-validates with the same shape (per source
  comments).
- **POSITIVE-K**: Storage buckets — chat-media (mig 235), course-videos,
  dm-media, kyc-documents, payment-screenshots are all `public=false`;
  avatars and course-thumbnails are public but image-only with size
  caps (verified via `storage.buckets`).
- **POSITIVE-L**: `supabase/functions/chat-media/index.ts:124-130` does
  server-side magic-byte sniffing (`detectMime`) and rejects when the
  client-claimed MIME doesn't match the sniffed one. SVG is not in any
  allowlist.
- **POSITIVE-M**: `supabase/functions/view-scraper/index.ts` uses
  `crypto.subtle.timingSafeEqual` for the scheduled-run secret header.
- **POSITIVE-N**: Email templates HTML-escape every interpolated user
  string via the local `escapeHtml` (lib/email-templates.ts:30-37).
  Admin notification HTML is sanitized via `sanitize-html` with a
  strict tag/attribute allowlist (app/api/admin/notifications/send/route.ts:14-43).
- **POSITIVE-O**: No `dangerouslySetInnerHTML` outside `app/layout.tsx`
  (theme-init script + Meta Pixel — both static, both nonce-protected).
- **POSITIVE-P**: No `eval(` or `new Function(` anywhere under
  `app lib components`. No `"use server"` server actions in App Router.
- **POSITIVE-Q**: No hardcoded JWTs / RSA private keys / API keys
  found in `app lib components scripts supabase/functions hooks
contexts` — regex sweep returned 0 hits.
- **POSITIVE-R**: `.gitignore` covers `.env*`, `.env`, `.env.staging`,
  `.env.production`, `.mcp.json`, `.codex/`, `*.pem`.
- **POSITIVE-S**: Middleware skip-list uses `route.startsWith(pathname)`
  shadow correctly — only `/api/payments/keepz/callback` skips, and its
  prefix doesn't shadow any sibling route.
- **POSITIVE-T**: Account deletion (`app/api/account/delete/route.ts`)
  requires re-auth via `signInWithPassword`, blocks lecturers/admins,
  anonymizes (not deletes) `keepz_payments.user_id` and
  `payment_audit_log.user_id`, writes a `self_account_deleted` audit
  tombstone before calling `auth.admin.deleteUser`.

## §6 Coverage matrix

### 6.1 API routes (app/api/\*\*/route.ts) — 75 routes

Read in full for the matrix below: payments/keepz/_ (5), kyc/_ (3),
withdrawals (1), account/delete (1), admin/kyc/** (4),
admin/withdrawals/** (3), admin/lecturer-approvals/[id]/approve (1),
admin/notifications/send (1), admin/settings (1), admin/payments (1),
admin/submissions/[id]/pay (1), admin/view-scraper/run (1), profile (1),
balance (1), notifications (1), me/enrollments (1), public/coming-soon (1),
public/validate-referral-code (1), validate-referral-code (1),
chat-media/sign (1), dm/media-url (1), complete-profile (1),
courses/[courseId]/video-url (1), courses/[courseId]/chats (1),
health (1), ping (1). The remaining ~45 routes (admin/analytics/_,
admin/bundle-enrollment-requests/_, admin/enrollment-requests/_,
admin/free-project-lecturers/_, admin/student-project-access/_,
admin/project-subscriptions/_, admin/emails/_, admin/view-scraper/_,
notifications/[id]/read, notifications/read-all,
notifications/unread-count, project-subscriptions, enrollment-requests,
bundle-enrollment-requests) follow the same pattern verified across
sampled admin routes (`getTokenFromHeader → verifyTokenAndGetUser →
check_is_admin RPC → adminLimiter.check(user.id) → action → logAdminAction`)
or the same user-route pattern (`Bearer → verifyTokenAndGetUser →
generalLimiter/accountLimiter → user-scoped supabase`). Listed below
as "pattern: admin" or "pattern: user".

| Route                                                                                                                                                             | Auth                                        | Authz                                        | Validation                          | Rate-limit                              | Audit-log                       | Notes                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------- | ----------------------------------- | --------------------------------------- | ------------------------------- | --------------------------------------------------------- |
| GET /api/health                                                                                                                                                   | none                                        | n/a                                          | n/a                                 | none                                    | n/a                             | Trivial health                                            |
| GET /api/ping                                                                                                                                                     | none                                        | n/a                                          | n/a                                 | none                                    | n/a                             | Trivial                                                   |
| POST /api/public/coming-soon                                                                                                                                      | none                                        | n/a                                          | EMAIL_RE                            | subscribeLimiter (3/60s by IP)          | n/a                             | Service-role insert; silent dedupe                        |
| POST /api/public/validate-referral-code                                                                                                                           | none                                        | n/a                                          | `^[A-Za-z0-9]{1,20}$`               | referralLimiter (10/60s by IP)          | n/a                             | Random 100-200ms delay                                    |
| POST /api/validate-referral-code                                                                                                                                  | Bearer                                      | own                                          | regex                               | referralLimiter (by IP)                 | n/a                             | Rejects own code                                          |
| GET /api/profile                                                                                                                                                  | Bearer                                      | own                                          | n/a                                 | none ✗                                  | n/a                             | Returns own row only                                      |
| PATCH /api/profile                                                                                                                                                | Bearer                                      | own                                          | regex (username), avatar URL prefix | accountLimiter (by IP — SEC-014)        | n/a                             | Updates only username, avatar_url                         |
| GET /api/me/enrollments                                                                                                                                           | Bearer                                      | own                                          | n/a                                 | generalLimiter (by IP)                  | n/a                             | own user_id scope                                         |
| POST /api/complete-profile                                                                                                                                        | Bearer                                      | own                                          | zod completeProfileSchema           | accountLimiter (by IP — SEC-014)        | n/a                             | Service-role write — SEC-007                              |
| GET /api/balance                                                                                                                                                  | Bearer                                      | own                                          | n/a                                 | none ✗ on GET                           | n/a                             | RPC + own-scope SELECT                                    |
| PATCH /api/balance                                                                                                                                                | Bearer                                      | own                                          | Georgian IBAN regex                 | accountLimiter (by IP)                  | n/a                             | bank_account_number only                                  |
| GET /api/withdrawals                                                                                                                                              | Bearer                                      | own                                          | n/a                                 | generalLimiter (by IP)                  | n/a                             | own-scope                                                 |
| POST /api/withdrawals                                                                                                                                             | Bearer                                      | own                                          | amount + IBAN                       | paymentLimiter (by IP)                  | implicit via RPC                | RPC re-validates KYC; no IBAN validation in RPC — SEC-008 |
| DELETE /api/account/delete                                                                                                                                        | Bearer + re-auth password                   | own (blocks lecturer/admin)                  | n/a                                 | accountLimiter (by IP — SEC-014)        | self_account_deleted            | Anonymizes, deletes auth user                             |
| POST /api/payments/keepz/create-order                                                                                                                             | Bearer                                      | own                                          | zod paymentOrderSchema              | paymentLimiter (by user.id)             | implicit (Keepz logs)           | Server-authoritative pricing                              |
| GET /api/payments/keepz/status                                                                                                                                    | Bearer                                      | own                                          | UUID                                | generalLimiter (by IP)                  | payment_audit_log on self-heal  | Self-healing via Keepz status API                         |
| GET /api/payments/keepz/verify-pending                                                                                                                            | Bearer                                      | own                                          | n/a                                 | paymentLimiter (by user.id)             | payment_audit_log per recovered | Per-user stale-payment recovery                           |
| POST /api/payments/keepz/callback                                                                                                                                 | none (skip-listed in middleware)            | encrypted-payload                            | shape check                         | callbackLimiter (by IP)                 | payment_audit_log every branch  | Always 200                                                |
| GET/DELETE /api/payments/saved-cards                                                                                                                              | Bearer                                      | own                                          | UUID (DELETE)                       | accountLimiter (by IP)                  | n/a                             | Soft delete                                               |
| POST /api/kyc/submit                                                                                                                                              | Bearer                                      | own                                          | strict path validator + phone       | paymentLimiter (by IP)                  | implicit (RPC)                  | doc-back required unless passport                         |
| GET /api/kyc/status                                                                                                                                               | Bearer                                      | own                                          | n/a                                 | generalLimiter (by IP)                  | n/a                             | Returns own row                                           |
| POST /api/kyc/cleanup                                                                                                                                             | Bearer                                      | own                                          | submissionId regex                  | generalLimiter (by IP)                  | n/a                             | Refuses if real submission exists                         |
| GET /api/notifications                                                                                                                                            | Bearer                                      | own                                          | page/limit clamp                    | notificationLimiter (60/60s by user.id) | n/a                             | own user_id                                               |
| GET/POST /api/notifications/[id]/read                                                                                                                             | Bearer                                      | own                                          | UUID                                | notificationLimiter (by user.id)        | n/a                             | pattern: user                                             |
| POST /api/notifications/read-all                                                                                                                                  | Bearer                                      | own                                          | n/a                                 | notificationLimiter (by user.id)        | n/a                             | pattern: user                                             |
| GET /api/notifications/unread-count                                                                                                                               | Bearer                                      | own                                          | n/a                                 | notificationLimiter (by user.id)        | n/a                             | pattern: user                                             |
| GET /api/courses/[courseId]/chats                                                                                                                                 | Bearer                                      | enrolled / lecturer / admin                  | UUID                                | generalLimiter (by IP)                  | n/a                             | RPC-backed admin check                                    |
| GET /api/courses/[courseId]/video-url                                                                                                                             | Bearer                                      | enrolled / lecturer / admin                  | UUID + path-prefix                  | generalLimiter (by IP)                  | n/a                             | Service-role 15min signed URL                             |
| GET /api/chat-media/sign                                                                                                                                          | Bearer                                      | admin / lecturer / enrolled / project-access | UUID×2 + path normalize             | none ✗ — SEC-011                        | n/a                             | 1h signed URL                                             |
| GET /api/dm/media-url                                                                                                                                             | Bearer                                      | dm participant                               | UUID + path normalize               | none ✗ — SEC-011                        | n/a                             | 15min signed URL                                          |
| GET/PUT /api/admin/settings                                                                                                                                       | PUT verifyAdminRequest; GET = any auth user | own (GET) / admin (PUT)                      | numeric coerce                      | adminLimiter (by user.id)               | n/a                             | platform_settings singleton                               |
| GET/POST /api/admin/payments                                                                                                                                      | Bearer + admin RPC                          | admin                                        | UUID + action='complete'            | none on GET ✗                           | payment_manual_complete         | Manual completion via complete_keepz_payment              |
| GET /api/admin/kyc                                                                                                                                                | Bearer + admin RPC                          | admin                                        | status filter allowlist             | adminLimiter (by user.id)               | view_kyc_submissions            | get_decrypted_profiles join                               |
| POST /api/admin/kyc/[submissionId]/approve                                                                                                                        | Bearer + admin RPC                          | admin                                        | UUID, notes ≤500                    | adminLimiter (by user.id)               | kyc_approved                    | TOCTOU — SEC-017                                          |
| POST /api/admin/kyc/[submissionId]/reject                                                                                                                         | Bearer + admin RPC                          | admin                                        | UUID, reason required ≤500          | adminLimiter (by user.id)               | kyc_rejected                    | reason embedded in notification text                      |
| GET /api/admin/kyc/[submissionId]/signed-urls                                                                                                                     | Bearer + admin RPC                          | admin                                        | UUID                                | adminLimiter (by user.id)               | kyc_documents_viewed            | 5-min signed URL                                          |
| GET /api/admin/withdrawals                                                                                                                                        | Bearer + admin RPC                          | admin                                        | status filter allowlist             | adminLimiter (by user.id)               | view_withdrawals                | RPC + service-role profiles join                          |
| POST /api/admin/withdrawals/[requestId]/approve                                                                                                                   | Bearer + admin RPC                          | admin                                        | UUID, notes ≤500                    | adminLimiter (by user.id)               | withdrawal_approved             | RPC FOR UPDATE; TOCTOU — SEC-017                          |
| POST /api/admin/withdrawals/[requestId]/reject                                                                                                                    | Bearer + admin RPC                          | admin                                        | UUID                                | adminLimiter (by user.id)               | withdrawal_rejected             | balance restored implicitly via debit reversal            |
| POST /api/admin/lecturer-approvals/[id]/approve                                                                                                                   | Bearer + admin RPC                          | admin                                        | UUID                                | adminLimiter (by user.id)               | lecturer_approved               | RPC matches lecturer_status='pending'                     |
| POST /api/admin/lecturer-approvals/[id]/reject                                                                                                                    | pattern: admin                              | admin                                        | UUID                                | adminLimiter                            | lecturer_rejected               | (not opened)                                              |
| POST /api/admin/notifications/send                                                                                                                                | Bearer + admin RPC                          | admin                                        | category allowlist + zod-ish        | adminLimiter (by user.id)               | send_notification               | sanitize-html for HTML; SEC-010                           |
| POST /api/admin/submissions/[id]/pay                                                                                                                              | verifyAdminRequest                          | admin                                        | UUID + amount                       | adminLimiter                            | implicit                        | atomic RPC pay_submission                                 |
| POST /api/admin/view-scraper/run                                                                                                                                  | Bearer + admin RPC                          | admin                                        | UUID (project_id)                   | none ✗                                  | run_scraper                     | Proxies to edge fn                                        |
| GET /api/admin/view-scraper/\* (history, runs, results, schedule, submissions)                                                                                    | pattern: admin                              | admin                                        | UUID                                | adminLimiter                            | mostly read-only                | (sampled, not all opened)                                 |
| POST/PATCH /api/admin/view-scraper/{check,schedule}                                                                                                               | pattern: admin                              | admin                                        | per-route                           | adminLimiter                            | per-route                       | (not opened)                                              |
| GET/POST/PATCH/DELETE /api/admin/{enrollment-requests,bundle-enrollment-requests,project-subscriptions,student-project-access,free-project-lecturers,emails}/\*\* | pattern: admin                              | admin                                        | UUID                                | adminLimiter                            | per-route                       | Sampled; consistent                                       |
| GET /api/admin/analytics/\* (engagement, financial, operational, overview, projects, referrals, revenue, users)                                                   | pattern: admin                              | admin                                        | n/a                                 | adminLimiter (assumed)                  | per-route                       | (not opened — admin-only read)                            |
| POST /api/enrollment-requests, /api/bundle-enrollment-requests, /api/project-subscriptions                                                                        | pattern: user                               | own                                          | per-route + zod                     | generalLimiter / writeLimiter           | n/a                             | (sampled)                                                 |

### 6.2 Edge functions (supabase/functions/) — 28 (excluding `_shared`, `import_map.json`)

| Function                                                                                                                                                                      | First-call auth                                       | Service-role usage                                                          | CORS allowlist                                                                           | Validation                                                 | Dep pin                                          | Notes                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| \_shared/auth.ts                                                                                                                                                              | n/a                                                   | n/a                                                                         | n/a                                                                                      | Bearer extraction                                          | `@supabase/supabase-js@2.98.0`                   | Used by all                            |
| \_shared/cors.ts                                                                                                                                                              | n/a                                                   | n/a                                                                         | swavleba.ge, www.swavleba.ge, plankton-app-wpsym.ondigitalocean.app (+ localhost in dev) | n/a                                                        | n/a                                              | ✓                                      |
| \_shared/sniff.ts                                                                                                                                                             | n/a                                                   | n/a                                                                         | n/a                                                                                      | magic-byte detection (no SVG)                              | n/a                                              | ✓                                      |
| \_shared/email.ts                                                                                                                                                             | n/a                                                   | n/a                                                                         | n/a                                                                                      | n/a                                                        | resend@2.1.0 (per package.json + commit c1025a0) | ✓                                      |
| \_shared/supabase.ts                                                                                                                                                          | n/a                                                   | n/a                                                                         | n/a                                                                                      | n/a                                                        | pinned                                           | ✓                                      |
| chat-media                                                                                                                                                                    | getAuthenticatedUser                                  | upload via user-scoped supabase; service-role only for signing in API route | dynamic                                                                                  | MIME allowlist + magic-byte sniff + 10MB cap + path layout | pinned                                           | ✓                                      |
| chat-messages                                                                                                                                                                 | (pattern: getAuthenticatedUser)                       | inferred                                                                    | dynamic                                                                                  | inferred                                                   | pinned                                           | (not opened)                           |
| chat-mute, chat-pins, chat-typing, chat-unread                                                                                                                                | pattern: getAuthenticatedUser                         | varies                                                                      | dynamic                                                                                  | varies                                                     | pinned                                           | (not opened)                           |
| course-chats                                                                                                                                                                  | pattern                                               | inferred                                                                    | dynamic                                                                                  | inferred                                                   | pinned                                           | (not opened)                           |
| dm-conversations, dm-media, dm-messages, dm-unread                                                                                                                            | pattern: getAuthenticatedUser                         | varies                                                                      | dynamic                                                                                  | varies                                                     | pinned                                           | (not opened)                           |
| friends                                                                                                                                                                       | pattern                                               | inferred                                                                    | dynamic                                                                                  | inferred                                                   | pinned                                           | (not opened)                           |
| notifications, notifications-read-all, notifications-unread-count, notification-read                                                                                          | pattern: getAuthenticatedUser                         | varies                                                                      | dynamic                                                                                  | varies                                                     | pinned                                           | (not opened)                           |
| me-enrollments                                                                                                                                                                | pattern                                               | own                                                                         | dynamic                                                                                  | inferred                                                   | pinned                                           | (not opened)                           |
| balance                                                                                                                                                                       | pattern                                               | own                                                                         | dynamic                                                                                  | inferred                                                   | pinned                                           | (not opened)                           |
| validate-referral-code                                                                                                                                                        | service-role (anon-callable per API parallel)         | service-role                                                                | dynamic                                                                                  | regex                                                      | pinned                                           | (not opened — mirrors API)             |
| view-scraper                                                                                                                                                                  | x-scraper-secret OR getAuthenticatedUser+checkIsAdmin | service-role for write                                                      | dynamic + extra `x-scraper-secret`                                                       | timing-safe secret compare; URL platform check (SEC-003)   | pinned                                           | ✓ Dual auth                            |
| withdrawals                                                                                                                                                                   | pattern                                               | inferred                                                                    | dynamic                                                                                  | inferred                                                   | pinned                                           | (not opened — mirrors API)             |
| enrollment-requests, bundle-enrollment-requests                                                                                                                               | pattern                                               | inferred                                                                    | dynamic                                                                                  | inferred                                                   | pinned                                           | (not opened)                           |
| admin-bundle-enrollment-{approve,reject,requests}, admin-enrollment-{approve,reject,requests}, admin-notifications-send, admin-withdrawal-{approve,reject}, admin-withdrawals | getAuthenticatedUser+checkIsAdmin                     | service-role for read/write                                                 | dynamic                                                                                  | UUID + per-route                                           | pinned                                           | (not opened — mirror API admin routes) |
| health                                                                                                                                                                        | none                                                  | n/a                                                                         | dynamic                                                                                  | n/a                                                        | pinned                                           | Trivial                                |

**No `verify_jwt = false` discovered** outside the standard convention
documented in CLAUDE.md (the pattern is for edge fns that authenticate
via `getAuthenticatedUser` themselves). `supabase/config.toml` does not
override it, and no per-function `[functions.<name>]` block disables JWT
verification in the repo.

### 6.3 Sensitive tables × RLS posture (verified against staging via `pg_policies` + `pg_publication_tables`)

| Table                                                                                                                                                                      | RLS | SELECT scope                      | INSERT scope                                         | UPDATE scope                                                                              | In realtime?                                                                                | Notes                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| profiles                                                                                                                                                                   | ✓   | own + admin                       | own (auth.uid=id)                                    | own row, blocked privileged columns by 3 triggers (SEC-005 — `referral_code` not blocked) | YES                                                                                         | Encrypted PII columns; `protect_profiles_role` ✓ |
| balance_transactions                                                                                                                                                       | ✓   | own + admin                       | (no policy — service-role only via debit/credit RPC) | (none)                                                                                    | NO                                                                                          | ✓                                                |
| keepz_payments                                                                                                                                                             | ✓   | own + (service-role read via JWT) | own                                                  | (none — service-role only)                                                                | YES                                                                                         | callback_payload may include card metadata       |
| withdrawal_requests                                                                                                                                                        | ✓   | own + admin                       | own                                                  | admin                                                                                     | YES                                                                                         | encrypted_iban via trigger                       |
| kyc_submissions                                                                                                                                                            | ✓   | own + admin                       | own                                                  | admin                                                                                     | YES                                                                                         | `protect_profiles_kyc_status` ✓                  |
| referrals                                                                                                                                                                  | ✓   | referrer/referred + admin         | NONE (false WITH CHECK — SECURITY DEFINER only)      | (none)                                                                                    | YES                                                                                         | ✓                                                |
| submission_reviews                                                                                                                                                         | ✓   | broad SEC-006 ✗                   | lecturer-scoped                                      | lecturer / admin                                                                          | YES                                                                                         | SEC-006 broad SELECT                             |
| notifications                                                                                                                                                              | ✓   | own + admin + service-role        | admin / service-role                                 | own (read=true only)                                                                      | YES                                                                                         | DELETE blocked (`false`) ✓                       |
| dm_conversations                                                                                                                                                           | ✓   | (via dm_participants)             | (via RPC)                                            | (none)                                                                                    | NO                                                                                          | ✓                                                |
| dm_participants                                                                                                                                                            | ✓   | is_dm_participant()               | (via RPC)                                            | (none)                                                                                    | NO                                                                                          | recursion-safe per mig 222                       |
| dm_messages                                                                                                                                                                | ✓   | participants                      | participants                                         | author                                                                                    | YES                                                                                         | ✓                                                |
| dm_unread_messages                                                                                                                                                         | ✓   | (assumed own)                     | (via trigger)                                        | (via trigger)                                                                             | YES                                                                                         | (sampled)                                        |
| friend_requests, friendships                                                                                                                                               | ✓   | own pair                          | own                                                  | (none)                                                                                    | YES                                                                                         | ✓                                                |
| project_subscriptions                                                                                                                                                      | ✓   | own + admin                       | own                                                  | admin                                                                                     | YES                                                                                         | ✓                                                |
| projects                                                                                                                                                                   | ✓   | (sampled)                         | per-route                                            | per-route                                                                                 | YES                                                                                         | (assumed pattern)                                |
| project_submissions                                                                                                                                                        | ✓   | (sampled)                         | per-route                                            | per-route                                                                                 | YES                                                                                         | (assumed pattern)                                |
| coming_soon_emails                                                                                                                                                         | ✓   | admin only                        | NONE (service-role only — mig 237)                   | (none)                                                                                    | YES                                                                                         | ✓                                                |
| audit_log                                                                                                                                                                  | ✓   | admin SELECT                      | admin or via insert_audit_log RPC                    | (none)                                                                                    | NO                                                                                          | ✓                                                |
| payment_audit_log                                                                                                                                                          | ✓   | admin / own                       | service-role                                         | (none)                                                                                    | NO                                                                                          | ✓                                                |
| platform_settings                                                                                                                                                          | ✓   | any auth user                     | admin                                                | admin                                                                                     | NO                                                                                          | ✓                                                |
| courses, channels, enrollments, enrollment_requests, bundle_enrollment_requests, bundle_enrollments, course_bundles, course_bundle_items, video_progress, videos, services | ✓   | varies                            | varies                                               | varies                                                                                    | mostly YES (channels/courses/enrollment_requests/enrollments yes; videos/video_progress no) | (sampled — consistent)                           |
| view_scrape_runs, view_scrape_results                                                                                                                                      | ✓   | admin                             | service-role / x-scraper-secret                      | service-role                                                                              | YES                                                                                         | ✓                                                |
| email_send_history                                                                                                                                                         | ✓   | admin                             | service-role                                         | (none)                                                                                    | YES                                                                                         | ✓                                                |
| muted_users                                                                                                                                                                | ✓   | own + admin                       | lecturer                                             | (none)                                                                                    | NO                                                                                          | ✓                                                |
| message_attachments, message_reactions, chat_pinned_messages, messages                                                                                                     | ✓   | enrolled / channel scope          | enrolled / channel scope                             | author                                                                                    | YES                                                                                         | (sampled)                                        |
| typing_indicators                                                                                                                                                          | ✓   | participants                      | participants                                         | participants                                                                              | YES                                                                                         | ✓                                                |
| saved_cards                                                                                                                                                                | ✓   | own                               | (none — set by callback service-role)                | own (is_active flag only via API)                                                         | NO                                                                                          | ✓                                                |

## §7 Things I could not verify

- **Fully open and read every one of the 75 routes / 28 edge fns**.
  I read enough to confirm the auth+limiter pattern, but ~45 routes and
  ~20 edge fns were classified by pattern, not by line. Specifically:
  none of `app/api/admin/analytics/**`, none of
  `app/api/admin/student-project-access/**`,
  `app/api/admin/free-project-lecturers/**`,
  `app/api/admin/project-subscriptions/**`,
  `app/api/admin/{view-scraper/{check,history,runs,schedule,submissions}}`,
  `app/api/admin/emails/**` were opened in this audit. They follow the
  admin pattern but unopened files may carry per-route quirks.
- **Edge function bodies** beyond `chat-media`, `view-scraper`, `_shared/*`
  were not opened. The dual-auth + magic-byte + path layout patterns
  in `chat-media` are a strong baseline; I did not verify each `dm-*`,
  `chat-*`, `admin-*` edge function reproduces it.
- **handle_new_user OAuth path post-mig-207** — I verified the email
  branch line-by-line but only sampled the OAuth branch. The trigger
  is the canonical regression-prone path per CLAUDE.md.
- **Realtime broadcast filtering** — I confirmed RLS is in place for
  every realtime-published table, and Realtime authorization uses RLS,
  but I did not connect a live subscriber to verify cross-tenant deltas
  don't leak via the channel.
- **Apify-side data integrity** in view-scraper — the lecturer payout
  is computed off scraped view counts. Apify is treated as trusted
  here. Compromise of Apify or response tampering at the edge = direct
  payout impact. Not verifiable from this audit.
- **Production parity** — staging RLS posture matches what I read in
  migrations, but production (`nbecbsbuerdtakxkrduw`) was deliberately
  not queried. If migration apply order on production diverged from
  staging (see SEC-012), production may carry different policies than
  what I verified.
- **Tests** — there is no test framework configured (per CLAUDE.md).
  None of the findings here are demonstrated via running tests; all
  are static + DB-introspection.
- **`mcp__supabase__get_logs`** — not sampled. A run-time log scan
  for accidentally-logged secrets and 5xx clusters would close the
  remaining "what's actually leaking in prod" question.

## §8 Appendix A — DB advisor output (summarised)

`mcp__supabase__get_advisors(type='security')` returned 48 lints, all
WARN level, all of one of two kinds:

- **`anon_security_definer_function_executable` × 2** — `check_is_admin`,
  `has_project_access`. Captured in SEC-013.
- **`authenticated_security_definer_function_executable` × 46** — every
  SECURITY DEFINER function callable by `authenticated`. The vast
  majority are **intentional and safe**: each has an internal admin
  check (`IF NOT public.check_is_admin(auth.uid()) THEN RAISE EXCEPTION
…`) or an `auth.uid() = …` predicate. The findings worth specific
  mention are pulled into SEC-001, SEC-004, SEC-005, SEC-008, SEC-009.
  The remainder are advisory noise that the linter cannot distinguish
  from intent.

`mcp__supabase__get_advisors(type='performance')` returned 198
`multiple_permissive_policies` lints (overlapping per-table SELECT
policies — performance only, not security) and 49 `unused_index` lints.
No security-relevant entries. Performance findings are out of scope here
but worth a separate pass for cost.

ERROR-level lints across both advisors: **none.**

## §9 Appendix B — `npm audit --omit=dev` (summary)

```
{
  "vulnerabilities": {
    "info": 0, "low": 0, "moderate": 1, "high": 1, "critical": 0,
    "total": 2
  },
  "dependencies": { "prod": 211, "dev": 79, "optional": 16, "peer": 1, "total": 305 }
}
```

| Pkg                  | Severity | Title                                         | CWE     | Range             | Fix                        |
| -------------------- | -------- | --------------------------------------------- | ------- | ----------------- | -------------------------- |
| next                 | High     | HTTP request deserialization → DoS (RSC)      | 400/502 | >=13.0.0 <15.0.8  | next@16.2.5 (semver-major) |
| next                 | High     | DoS with Server Components                    | 770     | >=13.0.0 <15.5.15 | same                       |
| next                 | Mod      | Image Optimizer DoS via remotePatterns        | 400/770 | >=10.0.0 <15.5.10 | same                       |
| next                 | Mod      | HTTP request smuggling in rewrites            | 444     | >=9.5.0 <15.5.13  | same                       |
| next                 | Mod      | Unbounded next/image disk cache               | 400     | >=10.0.0 <15.5.14 | same                       |
| postcss (transitive) | Mod      | XSS via unescaped `</style>` in CSS Stringify | 79      | <8.5.10           | resolves with next upgrade |

All five Next entries chain to the same remediation: upgrade to
`next@16.2.5`.

## §10 Appendix C — What's solid (preserve, do not regress)

- The two `protect_profiles_*` triggers + the column-level
  `protect_profiles_privileged_columns`. **Do not** start using
  service-role clients for routine profile UPDATEs; route them through
  user-scoped clients so these triggers continue to enforce.
- `complete_keepz_payment`'s row-locked, idempotency-aware design.
- `decrypt_pii` being completely revoked from PostgREST roles + the
  fail-closed wrapper from migration 233 (returns NULL not ciphertext).
- The KYC path validator and its RPC re-validation (mig 217 +
  app/api/kyc/submit/route.ts).
- `lib/admin-auth.ts` `verifyAdminRequest`'s combined auth + admin RPC
  - admin rate limit. Use this everywhere instead of inlined
    `checkAdmin(supabase, user.id)` patterns; some routes still inline
    it (admin/withdrawals, admin/kyc/[id]/{approve,reject},
    admin/lecturer-approvals/[id]/{approve,reject}) — refactor opportunity.
- Encrypted-payload requirement on the Keepz callback +
  always-200 response + comprehensive `payment_audit_log`.
- Storage-bucket privatization (chat-media, dm-media, course-videos,
  kyc-documents, payment-screenshots) + signed-URL gates in the API.
- The CSP nonce flow and prod `unsafe-eval` strip in `middleware.ts`.
- No hardcoded secrets, no `eval`, no `"use server"` actions.
