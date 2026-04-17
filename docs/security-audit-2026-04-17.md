# Security Audit — 2026-04-17

Audit scope: Next.js web app (`app/`, `components/`, `hooks/`, `lib/`, `middleware.ts`) + Supabase DB (`public` schema, storage, edge functions) on **staging** project `bvptqdmhuumjbyfnjxdt`. Production project `nbecbsbuerdtakxkrduw` advisors not reached (MCP session bound to staging). DB and code findings assumed to apply to prod unless migrations diverge — flagged in findings where relevant.

## Summary

| Severity | Count | Example                                         |
| -------- | ----- | ----------------------------------------------- |
| CRITICAL | 3     | Anon can impersonate any user in friend/DM RPCs |
| HIGH     | 4     | `chat-media` bucket is publicly readable        |
| MEDIUM   | 8     | Missing zod validation on 56/62 API routes      |
| LOW      | 6     | Duplicate `2.ts` files, audit-log IP plaintext  |
| ACCEPTED | 3     | CSP `style-src 'unsafe-inline'` (documented)    |

Overall posture is strong on the code path (auth primitives, PII encryption, Keepz payment flow, handle_new_user, CSP with nonce, admin edge-function check pattern). All genuine findings cluster in one area — the friend-request / DM system added in migration `196_friend_requests_and_dms.sql` — plus the already-public `chat-media` storage bucket.

---

## CRITICAL (exploit now — auth bypass / impersonation)

### [C1] `send_friend_request` allows anon to impersonate any user

- **File/Migration:** `supabase/migrations/196_friend_requests_and_dms.sql` (function body confirmed live via `pg_get_functiondef('public.send_friend_request'::regproc)`)
- **Vector:** Function is `SECURITY DEFINER` (bypasses RLS), `SET search_path = public, pg_temp` (correct), but `EXECUTE` is granted to `anon`, `public`, and `authenticated`. Body signature is `send_friend_request(sender uuid, receiver uuid)` and the implementation trusts the `sender` parameter — no `IF sender != auth.uid() THEN RAISE EXCEPTION`. Attacker opens DevTools, grabs the public `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then:
  ```
  POST https://bvptqdmhuumjbyfnjxdt.supabase.co/rest/v1/rpc/send_friend_request
  apikey: <anon_key>
  Authorization: Bearer <anon_key>
  Content-Type: application/json
  { "sender": "<victim_A_uuid>", "receiver": "<victim_B_uuid>" }
  ```
  The function inserts `friend_requests(sender_id=A, receiver_id=B)`. RLS `friend_requests_insert` policy requires `auth.uid() = sender_id`, but SECURITY DEFINER bypasses that policy entirely.
- **Impact:** Anyone on the internet can forge friend requests from any user to any user — provided they can enumerate two UUIDs (enumerable via enrolled-co-member profile views, or via targeted social engineering). Enables reputation attacks, spam, unwanted auto-friendships (chained with C2/C3 for DM abuse).
- **Fix:**
  ```sql
  CREATE OR REPLACE FUNCTION public.send_friend_request(sender uuid, receiver uuid)
   RETURNS jsonb ... AS $$
  BEGIN
    IF auth.uid() IS NULL OR sender != auth.uid() THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
    -- ... rest unchanged
  ```
  Then `REVOKE EXECUTE ON FUNCTION public.send_friend_request(uuid, uuid) FROM PUBLIC, anon;` (keep `authenticated` grant).
- **Effort:** S

### [C2] `get_or_create_dm_channel` allows anon to create DM channels between arbitrary users

- **File/Migration:** `supabase/migrations/196_friend_requests_and_dms.sql` (live definition confirmed)
- **Vector:** Same shape as C1. Signature `get_or_create_dm_channel(uid1 uuid, uid2 uuid)` — SECURITY DEFINER, granted to `anon/public/authenticated`, no `auth.uid()` check. Attacker calls it with any two user UUIDs and a `dm_channels` row is created. RLS `dm_channels_insert` (`auth.uid() = user1_id OR user2_id`) is bypassed.
- **Impact:** Unbounded write to `dm_channels` (storage/DoS). Can seed channels between unrelated users as a vector for C3 or for generating realtime notifications that leak social graph. Combined with C3 this becomes a harassment primitive.
- **Fix:** Add authorization gate at top of function body:
  ```sql
  IF auth.uid() IS NULL OR (auth.uid() != uid1 AND auth.uid() != uid2) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  ```
  And `REVOKE EXECUTE ... FROM PUBLIC, anon;`.
- **Effort:** S

### [C3] `increment_dm_unread` allows anon to inflate any user's unread counter

- **File/Migration:** `supabase/migrations/196_friend_requests_and_dms.sql` (live definition confirmed)
- **Vector:** Signature `increment_dm_unread(p_channel_id uuid, p_user_id uuid)`, SECURITY DEFINER, granted to `anon/public/authenticated`. No check that caller owns the channel or the user. Called repeatedly, the target user sees an ever-growing unread badge they cannot clear (until `reset_dm_unread` runs, which M1 also allows strangers to call).
- **Impact:** UX-level DoS / harassment. A script can increment any user's unread count thousands of times per second.
- **Fix:** This function is called from triggers (`trigger_dm_message_unread`). If no external caller legitimately invokes it, restrict it to `service_role`/triggers only:
  ```sql
  REVOKE EXECUTE ON FUNCTION public.increment_dm_unread(uuid, uuid) FROM PUBLIC, anon, authenticated;
  ```
  If external callers exist, add `IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;` but note the semantic is odd — a user shouldn't be incrementing their own unread count.
- **Effort:** S

---

## HIGH (privilege escalation, PII exposure, payment fraud)

### [H1] `chat-media` storage bucket is `public=true` — all chat attachments readable by URL without auth

- **File/Migration:** `supabase/migrations/023_create_chat_media_bucket.sql` (bucket creation); live state confirmed via `SELECT public FROM storage.buckets WHERE id='chat-media'` → `true`
- **Vector:** Supabase buckets with `public=true` expose every object via `https://<project>.supabase.co/storage/v1/object/public/chat-media/<path>` — the `/public/` route skips all RLS policies on `storage.objects`. The extensive RLS policies for chat-media (`Enrolled users can read chat media`, admin/lecturer/owner variants) only gate the authenticated `/object/authenticated/` route, which is never used when the bucket is public. Object paths are `<course_id>/<channel_id>/<user_id>/<filename>` — all four components are UUIDs, so URLs are unguessable, BUT: (1) URLs are often logged, shared, cached, or leaked through client-side bundling; (2) a course_id leak (many are semi-public) + enumeration of filenames can yield viable URLs; (3) CDN caches may leak recently-accessed objects.
- **Impact:** Course chat attachments (images, videos, documents — potentially including student-submitted work, personal photos, screenshots with PII) are effectively unrestricted read. Directly conflicts with the "enrolled-only" access model implied by the RLS policies.
- **Fix:** Flip bucket to private. Because existing chat URLs referenced in `messages.content` / `message_attachments.url` will become `/public/` paths that no longer work, we either (a) rewrite those URLs to `/authenticated/` + signed URLs, or (b) keep the legacy `/public/` URLs working via a permissive SELECT policy + accept the status quo. Recommended: option (a) in a gated migration —
  ```sql
  UPDATE storage.buckets SET public = false WHERE id = 'chat-media';
  ```
  Then the frontend must switch to `supabase.storage.from('chat-media').createSignedUrl(path, ttl)`. This is a sizable change; see ABORT CONDITIONS in original plan. !!! CONFIRM BEFORE APPLYING — flipping `public=false` breaks every existing chat media URL in production unless the frontend is updated in the same deploy.
- **Effort:** L (requires frontend change to use signed URLs)

### [H2] `chat-media` has a 10 GB file size limit

- **File/Migration:** `supabase/migrations/124_storage_file_size_limits.sql` (set the limit); live `file_size_limit = 10737418240`
- **Vector:** Any authenticated enrolled user can upload a 10 GB file per message. With cheap DO storage pricing this is a direct cost-inflation attack: a handful of uploads exhausts a project's plan.
- **Impact:** Cost / DoS. Legitimate chat content is tiny (MB-scale images/short clips). The 10 GB ceiling matches `course-videos` but is inappropriate for chat.
- **Fix:**
  ```sql
  UPDATE storage.buckets SET file_size_limit = 104857600 WHERE id = 'chat-media';  -- 100 MB
  ```
- **Effort:** S

### [H3] `accept_friend_request` lacks `auth.uid()` check

- **File/Migration:** `supabase/migrations/196_friend_requests_and_dms.sql` (live)
- **Vector:** Signature `accept_friend_request(request_id uuid, accepting_user uuid)`. Internally does `SELECT * FROM friend_requests WHERE id = request_id AND receiver_id = accepting_user AND status = 'pending'`. Attacker must supply a valid `request_id` (UUID — 122-bit entropy, not guessable). Lower practical exploitability than C1/C2/C3 — but the function still trusts `accepting_user`, so an attacker who learns a request_id (e.g., from log leak, shared device) can auto-accept it on behalf of the real receiver.
- **Impact:** Forced mutual friendship + enables DM by proxy. Narrow practical exposure today; becomes CRITICAL if a request_id leak vector is ever found (logs, URL params, debug endpoints).
- **Fix:** `IF auth.uid() IS NULL OR accepting_user != auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;` + revoke anon/public execute.
- **Effort:** S

### [H4] Info-disclosure SECURITY DEFINER functions callable by anon

- **Functions:** `can_dm_user(sender, receiver)`, `has_project_access(uid)`, `can_submit_to_project(uid, pid)`, `are_friends(uid1, uid2)`, `is_blocked(blocker, blocked)`
- **Vector:** All `SECURITY DEFINER`, `anon_can_execute = true`. Each returns a boolean from an internal query that bypasses RLS. With the public anon key, an attacker running random UUID pairs through `are_friends` / `is_blocked` builds a partial social graph + can probe project access status.
- **Impact:** Confidentiality: exposes block lists, friendship graph, subscription status — data the app otherwise protects through RLS. Not destructive, but violates the privacy model advertised to users.
- **Fix:** For each, revoke from `anon` and `PUBLIC`, keep only `authenticated` grant, and ideally add `IF auth.uid() IS NULL THEN RAISE EXCEPTION; END IF;` at top to be fail-safe. Example: `REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC, anon;`
- **Effort:** S (single migration)

---

## MEDIUM (info disclosure, weak validation, missing rate limits)

### [M1] `reset_dm_unread(channel_id, user_id)` callable by anon, trusts `p_user_id`

- **File/Migration:** `supabase/migrations/196_friend_requests_and_dms.sql`
- **Vector:** Same class as C1/C2/C3 but lower impact — `UPDATE dm_unread_messages SET unread_count = 0 ...`. Attacker can hide new messages from the recipient by resetting their counter.
- **Impact:** UX griefing; messages remain readable, but the unread badge is suppressed.
- **Fix:** `IF auth.uid() IS NULL OR p_user_id != auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;` + revoke anon/public execute.
- **Effort:** S

### [M2] Trigger functions `cleanup_dm_typing`, `trigger_dm_message_unread`, `update_unread_counts_on_video` granted EXECUTE to anon

- **Vector:** These are trigger functions (called by Postgres as part of insert/update triggers). They have no legitimate external-caller use. Grants to anon/public are unnecessary attack surface and could become exploitable if future revisions drop their `TG_*` checks and take user input.
- **Impact:** Today: none. Latent risk.
- **Fix:** `REVOKE EXECUTE ON FUNCTION public.cleanup_dm_typing() FROM PUBLIC, anon, authenticated;` (triggers bypass function privilege checks, so the revoke is harmless).
- **Effort:** S

### [M3] Keepz callback — `KEEPZ_ALLOWED_IPS` is optional in production

- **File:** `app/api/payments/keepz/callback/route.ts:39-62`
- **Vector:** If `KEEPZ_ALLOWED_IPS` env var is unset, the route logs a warning and proceeds — relying solely on RSA payload decryption (`decryptCallback(body)` at line 112) for authenticity. RSA is cryptographically strong, but defense-in-depth is absent. A future bug in `decryptCallback` or a misconfigured private key becomes single-point-of-failure.
- **Impact:** If the RSA path ever weakens, any attacker can send fake callbacks. Today: probably OK, but the security property is "RSA must hold" instead of "RSA AND IP allowlist both hold".
- **Fix:** Require `KEEPZ_ALLOWED_IPS` in production — fail closed if unset when `NODE_ENV === 'production'`. Get the live IP list from Keepz support and set the env var. The current `NODE_ENV !== 'production'` stack-trace leak on line 371-373 is already handled correctly.
- **Effort:** S (+ coordinate Keepz IP retrieval)

### [M4] Admin withdrawal edge function leaks Postgres error details

- **File:** `supabase/functions/admin-withdrawal-approve/index.ts` lines 63-72
- **Vector:** On RPC error, returns `{ error: "Failed to approve withdrawal request", details: approveError.message, code: approveError.code }` with 500. Postgres error messages can reveal schema internals (table names, constraint names, value samples).
- **Impact:** Info disclosure to authenticated admin (so scope is narrow), but runs counter to the canonical pattern used in `lib/admin-auth.ts:67-69` (`internalError` returns only `{error: "Internal server error"}`). Consistency matters — the caller is an admin, but logs may contain user PII if the RPC references a user row.
- **Fix:** Match the `internalError` pattern: return only `{ error: "Internal server error" }` and `console.error` the details server-side.
- **Effort:** S

### [M5] 56 of 62 API routes lack schema validation (zod)

- **File:** `app/api/**/route.ts` — only 6 routes import/use zod (`bundle-enrollment-requests`, `enrollment-requests`, `complete-profile`, `admin/bundle-enrollment-requests`, `payments/keepz/callback`, `payments/keepz/create-order`)
- **Vector:** Most routes do `const body = await req.json(); const { field } = body;` with ad-hoc checks. Missing strict schemas increases drift — type/shape assumptions in later code can silently break or enable type-confusion attacks (e.g., sending `amount: {$gt: 0}` or arrays where scalars expected).
- **Impact:** Not a present-day vulnerability (none of the spot-checked routes are exploitable in obvious ways), but a class of latent risk that grows with each new route. Admin analytics routes are `Admin + Zod` (good) — this is the inconsistency to fix.
- **Fix:** Add zod schemas to high-privilege routes first: `/admin/view-scraper/run`, `/admin/view-scraper/schedule`, `/admin/submissions/[id]/pay`, `/admin/settings` PUT, `/complete-profile`, `/balance` PATCH, `/profile` PATCH, `/bundle-enrollment-requests`, `/enrollment-requests`, `/payments/keepz/*`. Roll out gradually.
- **Effort:** L (phased)

### [M6] Missing rate limits on sensitive routes

- **File:** 33 of 62 routes don't import from `@/lib/rate-limit`
- **Examples:** `/account/delete`, `/me/enrollments`, `/project-subscriptions`, `/admin/payments`, `/lecturer/analytics`, `/admin/analytics/*`, `/admin/view-scraper/*`
- **Vector:** Abuse-prone endpoints (destructive: `account/delete`; or resource-heavy: admin analytics, view scraper) have no upstream throttle. Rely on Supabase/PG for backpressure.
- **Impact:** DoS / cost amplification. `account/delete` is especially concerning — should rate-limit per-user to block automated attacks on compromised sessions.
- **Fix:** Add `callbackLimiter`-style checks. Prioritize `/account/delete` (per-user, 3/hour), admin view-scraper runs (per-admin, 10/hour), analytics routes (per-admin, 60/min).
- **Effort:** M

### [M7] `messages` table has 18 overlapping permissive policies + 13 `auth_rls_initplan` warnings

- **File/Migration:** various — `016_create_messages_table.sql`, `018_update_profiles_rls_for_chat.sql`, `132_admin_messages_rls.sql`, etc.
- **Vector:** Performance advisor reported 18 `multiple_permissive_policies` on `messages` and 13 `auth_rls_initplan`. Multiple policies combined with OR broaden the attack surface — any one policy's predicate weakness exposes the whole table. `auth.uid()` re-evaluated per row is a DoS risk on the realtime chat hot path. Not a direct security hole, but security-adjacent.
- **Impact:** Query cost scales poorly under load; overlapping policies are harder to reason about during future audits.
- **Fix:** Consolidate policies (single INSERT policy instead of 5 overlapping ones); replace `auth.uid()` with `(select auth.uid())` inside USING/WITH CHECK bodies. Apply same treatment to `message_attachments`, `project_submissions`, `channels`, `profiles`.
- **Effort:** L

### [M8] `audit_log.ip_address` stored plaintext

- **File/Migration:** `supabase/migrations/120_audit_log.sql`
- **Vector:** IP addresses are PII under GDPR. They're stored plaintext in `audit_log.ip_address` for forensic purposes (legitimate interest).
- **Impact:** If the audit log is ever exported or leaked, IPs are exposed. Admin-only RLS protects it today.
- **Fix:** Options: (a) hash IPs with a server-side salt; (b) truncate to /24 IPv4 or /48 IPv6; (c) document the retention + legitimate-interest basis. Recommend (b) — hashing loses utility; truncation keeps abuse-pattern analysis working.
- **Effort:** M

---

## LOW (defense in depth / hygiene)

### [L1] Duplicate files `lib/supabase/client 2.ts` and `lib/supabase/server 2.ts`

- **Status:** `diff` confirms files are byte-identical to canonical (`client.ts`, `server.ts`). Grep across `/Users/bezhomatiashvili/Desktop/MainCourse/` shows zero imports referencing them. Safe to delete, but per CLAUDE.md rule: !!! confirm before deletion — I will NOT delete without explicit approval.
- **Fix:** After approval: `rm "lib/supabase/client 2.ts" "lib/supabase/server 2.ts"`.
- **Effort:** S

### [L2] All 34 live edge functions have `verify_jwt: false`

- **Status:** Spot-checked 3 (`admin-withdrawal-approve`, `balance`, `admin-notifications-send`) — all correctly call `getAuthenticatedUser(req)` from `_shared/auth.ts` and `checkIsAdmin` where needed. Pattern is defensible, consistent with CLAUDE.md policy.
- **Risk:** If a future edge function forgets the `getAuthenticatedUser` call, it becomes open to the internet. No runtime guardrail.
- **Fix:** Consider a lint rule / code-review checklist item: every `Deno.serve` handler must call `getAuthenticatedUser` before any DB work. Alternatively flip `verify_jwt: true` for admin-only functions so the infra enforces auth.
- **Effort:** M (policy change)

### [L3] Keepz callback: `console.error("[Keepz Callback] Payment processing failed:", { rpcError, rpcResult, ... })`

- **File:** `app/api/payments/keepz/callback/route.ts:281-286`
- **Risk:** `rpcResult` may contain payment/enrollment internals. Server-only (not returned to Keepz), but log aggregator retention matters.
- **Fix:** Redact `rpcResult` to `{ success: rpcResult?.success, warning: rpcResult?.warning }` when logging.
- **Effort:** S

### [L4] Performance advisor: 42 `unused_index`, 14 `unindexed_foreign_keys`, 1 `duplicate_index`

- **Risk:** Not security. Latency + cost.
- **Fix:** Separate perf cleanup pass. Not in scope for this audit.
- **Effort:** M

### [L5] `app/layout.tsx:122-166` has `dangerouslySetInnerHTML` for theme bootstrap + Meta Pixel

- **Status:** Reviewed. Both blocks use `nonce={nonce}` (per-request CSP nonce from `middleware.ts:8-10`). Contents are fully static strings — no user interpolation. Comment at line 121 says "NEVER insert user input here". Posture correct.
- **Action:** None needed. Flagged for completeness.

### [L6] Open-redirect helper

- **File:** `lib/validate-redirect.ts` (13 lines). Blocks `//`, `\\`, non-`/`-prefixed URLs. Used consistently at `app/auth/callback/route.ts:15`, `app/login/page.tsx:30,152`, `app/signup/page.tsx:37`.
- **Status:** Correct implementation. Flagged for completeness.
- **Action:** None needed.

---

## ACCEPTED RISKS (already documented; don't re-flag)

- **CSP `style-src 'unsafe-inline'`**: `middleware.ts:24-29` — Tailwind needs inline styles; script-src uses nonce; CSS-injection is low impact without script execution. Migration plan documented in the comment.
- **Edge functions `verify_jwt: false`**: CLAUDE.md explicitly permits this when the function handles auth via `getAuthenticatedUser`. All spot-checked functions comply.
- **Prior security work**: `docs/production-security-hardening-2026-04-16.md` and `docs/staging-security-hardening-2026-04-16.md` — this audit did not re-review the items already tracked there. Findings above are additive.

---

## Verification Artifacts

- Security advisor (staging): `{"lints": []}` — clean
- Performance advisor (staging): 414 lints — 0 `policy_exists_rls_disabled`, 0 `extensions_in_public_schema`, 0 `rls_enabled_no_policy`. Breakdown: 192 `multiple_permissive_policies`, 164 `auth_rls_initplan`, 42 `unused_index`, 14 `unindexed_foreign_keys`, 1 `duplicate_index`, 1 `auth_db_connections_absolute`
- `list_tables(public)`: 43 tables, all `rls_enabled = true`
- SECURITY DEFINER functions in `public`: 64 total. All have `SET search_path` configured. Grant anomalies detailed in C1–H4, M1, M2.
- Storage buckets: `course-videos` private ✓, `payment-screenshots` private ✓, `chat-media` PUBLIC ✗ (H1), `course-thumbnails` public (acceptable), `avatars` public (acceptable)
- PII plaintext-vs-encrypted column counts — all plaintext cols show 0 rows, encrypted cols populated (12 emails, 1 bank account in profiles; 3 bank accounts in withdrawal_requests)
- `handle_new_user()` — matches canonical mig 171/172: hardcodes `role = 'student'`, uses `wants_lecturer` only to set `lecturer_status = 'pending'` + `is_approved = false`. No role-escalation path.
- `complete_keepz_payment` — SECURITY DEFINER, `REVOKE ALL` from public/anon/authenticated, row-level lock via `FOR UPDATE`, idempotent, recovery path for partial-failure, double-credit guard via `WHERE status='pending' + GET DIAGNOSTICS`. Excellent.

---

## Phase 2 — Review Gate

Mark each finding with one of: `FIX NOW`, `DEFER`, `WON'T FIX`, `FALSE POSITIVE`.

Suggested minimum set for Phase 3:

- **Must fix**: C1, C2, C3, H4 (together one migration — authorization hardening on mig 196 functions)
- **Must decide**: H1 (chat-media public) — requires scope confirmation because it breaks existing URLs
- **Must fix**: H2 (chat-media size limit), H3 (accept_friend_request), M1 (reset_dm_unread), M2 (trigger function grants), M4 (withdrawal error leak)
- **Should fix**: M3 (KEEPZ_ALLOWED_IPS), M8 (audit IP) — operational coordination
- **Phased**: M5 (zod), M6 (rate limits), M7 (RLS consolidation) — multi-week effort
- **Hygiene**: L1 (remove duplicate files, needs approval), L3 (redact log)
