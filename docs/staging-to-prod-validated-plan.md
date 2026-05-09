# Validated Migration Plan: `staging` → `main` + Production Supabase

> **Read-only validation of the original plan.** No git, DB, deployment, or env changes have been made. This document corrects stale numbers, flags assumptions I cannot verify from this session, and surfaces issues the original plan missed. Where I'm not 100% sure, I say so.

---

## 0. Confidence Tags Used

- ✅ **Verified** — checked against the current repo and/or Supabase MCP.
- ❌ **Wrong** — original plan's claim contradicts current evidence.
- ⚠️ **Stale** — was probably true when written; not true now.
- 🟡 **Cannot verify from this session** — would need direct access to the production Supabase project (`nbecbsbuerdtakxkrduw`). The MCP available here is bound to **staging only** (`bvptqdmhuumjbyfnjxdt`). I will not pretend to know prod state.
- ➕ **New finding** — the original plan didn't mention this.

---

## 1. Validation of the Original Plan's Headline Numbers

| Original claim                                              | Reality (verified `2026-05-09`)                                                               | Tag                                                                                                                                                                                                                                |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 26 commits ahead of `main`                                  | **29 commits** ahead                                                                          | ⚠️ Stale — three commits landed since the plan was written: `8bee978 Final Fix Before Push`, `bbe25d2 chore: remove stale audit/security review docs`, `eb9a83c fix(admin): standardize lecturer-approvals on verifyAdminRequest`. |
| 0 commits behind                                            | 0 commits behind                                                                              | ✅                                                                                                                                                                                                                                 |
| 243 files changed                                           | 243 files                                                                                     | ✅                                                                                                                                                                                                                                 |
| +25,324 / −5,574                                            | **+22,401 / −8,123**                                                                          | ❌ The signed totals are wrong. The size of the change is similar; the deletions are much larger than reported (likely due to dead-code removal commits).                                                                          |
| 47 migration files differing                                | **50 migration files** differing                                                              | ❌ Three more than reported.                                                                                                                                                                                                       |
| 13 edge function files differing                            | 13 files (incl. `import_map.json` + new `_shared/sniff.ts`)                                   | ✅                                                                                                                                                                                                                                 |
| 6 new env vars                                              | 6 new vars in `.env.example`, with `TEAM_ACCESS_KEY` removed in favor of `TRUSTED_PROXY_HOPS` | ✅                                                                                                                                                                                                                                 |
| Production scale: 8 users · 1 keepz_payment · 13 audit rows | 🟡 Cannot verify                                                                              | I have no read access to prod from this session.                                                                                                                                                                                   |

**Net effect:** the original plan's directional read is correct (medium-high complexity, dominated by permission regressions), but you should not paste its headline numbers into a runbook — they are stale.

---

## 2. The Original Plan's Critical Assumption About the Migration Ledger Is Probably Wrong

The single most important claim in the original plan is in §3, "Unknown #1":

> `main` branch has migration files up to `194_*`. Prod DB has migrations 205–245 applied. Either those direct applications were recorded in `supabase_migrations.schema_migrations` (clean), or they were not (requires repair before any push).

This framing assumes the ledger contains versions like `205`, `206`, …, `245`. **Based on staging's own ledger, that assumption is almost certainly wrong.**

### Evidence (verified ✅)

The `supabase_migrations.schema_migrations` table on **staging** does NOT contain version numbers `205`–`246`. It contains **timestamps** like `20260504125921`, `20260504221433`, `20260507185511`, etc. The `name` column carries the prefixed filename (e.g. `242_atomic_admin_approvals`), but the **`version`** is a timestamp.

Examples from the live staging ledger:

| `version` (ledger) | `name` (ledger)                       | File on disk                                  |
| ------------------ | ------------------------------------- | --------------------------------------------- |
| `20260504125921`   | `free_project_lecturers`              | `205_free_project_lecturers.sql`              |
| `20260504221433`   | `terms_marketing_consent`             | `206_terms_marketing_consent.sql`             |
| `20260507142214`   | `242_atomic_admin_approvals`          | `242_atomic_admin_approvals.sql`              |
| `20260507185511`   | `restore_check_is_admin_anon_execute` | `246_restore_check_is_admin_anon_execute.sql` |
| `20260507152036`   | `withdrawal_iban_guard`               | `20260507151753_withdrawal_iban_guard.sql`    |

This is consistent with how Supabase MCP's `apply_migration` records entries (it writes a fresh timestamp as `version`, regardless of the file's prefix), and with the project rule from `CLAUDE.md`:

> Migrations: use `supabase migration new <descriptive_name>` (timestamp prefix). Do not hand-prefix sequential numbers — see `docs/supabase-guide.md`.

### Why this matters for the deploy

The original plan in §6 phase B prescribes:

```bash
supabase migration repair --status applied <version>   # for each "Bucket B" version
```

If you run `supabase db push` against **prod**, and prod's ledger looks like staging's (timestamp versions, not `205`/`206`/…), then:

1. `supabase db push` will compare local files (`205_*.sql` … `246_*.sql` plus the five `20260507*.sql`) against the ledger by **version**, i.e. the part of the filename before the first `_`.
2. For files like `205_free_project_lecturers.sql`, the CLI sees version `205` — which is **not** in the ledger (the ledger has `20260504125921` for the same content).
3. It will treat it as a new, unapplied migration and try to **re-run** the SQL.
4. Most of those re-runs will fail or silently no-op only if every statement is idempotent (`CREATE … IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, etc.). Anything else — `CREATE INDEX` without `IF NOT EXISTS`, plain `INSERT`, plain `ALTER … ADD COLUMN`, etc. — will throw.

**Verdict:** the original plan's "Bucket B repair" step is unsafe as written. Repairing version `205` does not make `supabase db push` skip `205_free_project_lecturers.sql` — it makes the ledger contain _both_ `205` and `20260504125921` for the same migration, and on the next push the CLI may try to apply other un-repaired files that are non-idempotent.

### What I'm not 100% sure about

- 🟡 I don't know the **prod** ledger's actual contents. It might genuinely contain numeric versions if those migrations were applied via the Dashboard SQL editor with a different version string. Until you run a `SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 100;` against `nbecbsbuerdtakxkrduw`, treat all "ledger reconciliation" steps as **theoretical**.
- 🟡 I don't know whether the 41 files numbered `205`–`245` on staging were ever pushed via `supabase db push`, or whether they were applied exclusively via `apply_migration` MCP calls (which writes timestamp versions). If staging has been driven entirely via MCP, prod likely has been too.

### Recommended replacement for §6 Phase B

Do **not** mass-`migration repair` until you have run the prod ledger query and reconciled it against the file list line by line. Three plausible outcomes:

1. **Prod ledger is timestamp-based, identical pattern to staging** → no `migration repair` needed. The hard part becomes: how do you push the 6 net-new migrations (`246_*` + the five `20260507*`) without `supabase db push` also re-running the 41 files numbered `205`–`245`? Answer: apply the 6 net-new migrations one at a time via `mcp__supabase__apply_migration` (which only records what you tell it to apply). Do **not** call `supabase db push` against prod.
2. **Prod ledger is mixed (some numeric versions from Dashboard SQL editor, some timestamps from MCP)** → reconcile case by case. Most likely outcome.
3. **Prod ledger is purely numeric `205`–`245` and `246`+`20260507*` are missing** → the original plan's `migration repair` flow is correct _for the missing entries only_, but skip the reverse case where ledger has timestamps and files have numeric prefixes.

---

## 3. The "Is the prod homepage broken?" question (original Unknown #2)

The plan asks: is the public homepage already broken on prod because mig `241_revoke_anon_grants_security` was applied without mig `246_restore_check_is_admin_anon_execute`?

🟡 I cannot answer this without prod access. I will not load `https://swavleba.ge` from this session because I don't have a verified network path that distinguishes prod-data from staging-data, and I shouldn't introduce noise into prod telemetry. Either you confirm this manually, or re-run the validation with prod MCP access.

If the homepage is broken: mig 246 is a **fix**, not a tweak — apply it at the start of the deploy window, even before the rest of the batch.

If the homepage is fine: mig 246 is a no-op safety net (anon already has EXECUTE through some other GRANT path).

---

## 4. New Findings the Original Plan Missed (➕)

### 4.1 ➕ Three commits the plan never enumerates

```text
8bee978 Final Fix Before Push
bbe25d2 chore: remove stale audit/security review docs from repo root
eb9a83c fix(admin): standardize lecturer-approvals on verifyAdminRequest + add structured auth-failure logging
```

The third one is meaningful — it changes admin-route auth handling. Read its diff before the deploy and add the affected route(s) to the Tier-1 smoke checklist. The other two are housekeeping.

### 4.2 ➕ The list of 13 differing edge functions in the plan is correct, but the plan understates the deploy graph

Verified file list (`git diff --stat origin/main..origin/staging supabase/functions/`):

```
_shared/sniff.ts                  +42  (new)
chat-media/index.ts               ±29
chat-messages/index.ts           ±251
chat-pins/index.ts               +310 (new)
chat-unread/index.ts              ±42
dm-conversations/index.ts        +241 (new)
dm-media/index.ts                +181 (new)
dm-messages/index.ts             +342 (new)
dm-unread/index.ts                +82 (new)
friends/index.ts                 +293 (new — note: there are two existing functions on staging
                                       called `friend-requests`(v1) and `blocked-users`(v1) at
                                       `source/index.ts` paths that look like deprecated stubs;
                                       the new `friends` function supersedes them)
health/index.ts                   ±17
import_map.json                    ±2
view-scraper/index.ts              ±9
```

Worth doing in §6 Phase E:

- ➕ **Don't deploy `friends/` until you've reconciled the relationship with the existing `friend-requests` and `blocked-users` functions on prod.** I don't know whether `friends/` is intended to replace them or sit alongside; the plan didn't mention this.
- ➕ The `chat-typing` and `chat-mute` functions on staging still live at the old `source/supabase/functions/...` entrypoint path. New functions live at `source/functions/...`. If your Phase E deploy uses `--project-ref` only and not a path arg, the CLI's path inference might re-route them — verify path locally first.

### 4.3 ➕ Migration directory has prefix collisions on disk

The following pairs share a numeric prefix on disk (verified by `ls`):

```
103_allow_project_access_users_view_channels.sql
103_view_scraper_schedule_rpcs.sql

104_allow_project_access_users_reply_to_projects.sql
104_grant_project_access_on_registration.sql

105_add_admin_rls_policies_project_submissions.sql
105_fix_project_access_data.sql

131_fix_gen_random_bytes_schema.sql
131_security_audit_fixes.sql

140_drop_search_users_function.sql
140_lecturer_approval_system.sql

168_fix_bundle_approval_overload_and_guard.sql
168_fix_keepz_payment_transaction_safety.sql

183_set_search_path_and_auth_guards.sql
183_video_enrollment_expiry_check.sql

224_add_channels_to_realtime.sql
224_privatize_dm_media.sql

233_decrypt_pii_fail_closed.sql
233_restore_search_path_pg_temp.sql

234_chat_media_bucket_size_cap.sql
234_extend_search_path_pg_temp.sql

237_coming_soon_emails_no_anon_insert.sql
237_profiles_drop_broad_read_policies.sql
```

There's a dedicated migration `20260507151755_collided_prefixes_reassert.sql` that explicitly fixes the resulting ledger drift. **This is decisive evidence that the staging team has been managing this with `apply_migration` (timestamp-versioned) and reconciling collisions in the ledger.** Reinforces §2's recommendation: do not run `supabase db push` against prod blindly.

### 4.4 ➕ Direct `from('profiles').select(...)` call sites still exist

The plan says (4.5) "grep deployed `main` for direct `profiles` selects." I ran the grep on the current working tree. The candidates that read profiles other than the user's own:

```
app/auth/callback/route.ts:83,159  — server route. Likely fine (server uses service role or auth'd to user).
app/settings/page.tsx:192          — CLIENT page. Selects what looks like the user's own row → unaffected by mig 237 (own-row policy still allows self-read). Verify in smoke.
app/api/payments/keepz/create-order/route.ts:56  — server, almost certainly service role.
app/api/health/route.ts:51         — service role.
```

Server routes calling `from('profiles')` with the **service role** client are unaffected by RLS at all. Server routes using the **auth'd user's** Supabase client are subject to RLS and may break if they read other users' profiles. There are no obvious client-side cross-user profile reads I can spot, but I have not done an exhaustive audit. Tier-1 smoke must include: profile pages of _other_ users (lecturer profile from a student session, etc.).

### 4.5 ➕ `app/api/admin/lecturer-approvals/route.ts` was changed in the latest commit

Commit `eb9a83c`. This route is one of the 9 admin endpoints affected by the auth standardization. Add to the Tier-1 smoke list explicitly: "log in as admin, fetch `/admin/lecturer-approvals`, verify rows render."

### 4.6 ➕ `run-all-migrations.sql` has been edited

It is meant to be a developer convenience for local fresh-DB bootstraps, but it is part of the diff. Confirm it is not invoked by any prod deploy script before pushing (it looks like a manual-use file, but the diff is +39 −4 lines).

### 4.7 ➕ The plan's Phase D rollback for mig `20260507104902` is incomplete

It says "rollback by redefining the trigger function with the prior column list. The prior version exists in mig 218 — copy the body from there." That's correct, but mig `20260507104902` extends a trigger. If the trigger fired on `UPDATE` and a row was updated between mig apply and rollback, the column-protection invariant is unaffected (it's read-time validation against incoming `NEW`), so no row is dirty. ✅ — but call this out explicitly so future-you doesn't second-guess and start trying to "undo" data.

### 4.8 ➕ The plan never considers `pg_dump` connection method

Section 4.1 / A2 says `pg_dump "postgres://<prod>" …`. Per `CLAUDE.md`:

> **IPv6 psql failures**: Use Dashboard SQL editor (most reliable) or REST API
> **Supabase CLI auth**: Store creds in `.env.supabase`, source before CLI — or use Dashboard SQL editor

`pg_dump` over IPv6 has been documented to fail on this stack. Plan A: use the **Supabase Dashboard → Database → Backups → Download backup** button. Plan B: use `supabase db dump --linked` once linked to prod (uses the same proxy as the CLI). Don't paste a raw `postgres://` URL and assume it'll connect.

---

## 5. Where the Original Plan Is Substantively Right

These parts hold up under scrutiny — keep them as-is:

- ✅ The **hard constraints** in §1 (no row mutation, idempotency, reversibility, no history rewrite). These match the project's `CLAUDE.md` rules exactly.
- ✅ The **risk taxonomy** in §11 (CRITICAL: ledger mismatch, mig 246 missing, handle_new_user regression, missing env vars, edge functions; LIKELY: profile RLS, atomic admin approvals, Keepz race, chat-media privatization, Resend pin; etc.). Comprehensive.
- ✅ The **decision** to do this in off-hours (8 prod users) and to not bother with canary infra. Right call.
- ✅ The **smoke checklist tiering** (Tier 1 in 15 min, Tier 2 in 60 min, Tier 3 in 24h). Right structure.
- ✅ The **PITR-as-default-rollback** stance. If a multi-mig failure happens and you're on Pro plan, PITR is the only option that guarantees byte-identical restore.
- ✅ The **`--no-ff` merge** preference for revertability. Right.
- ✅ The **list of 6 net-new migrations** to apply (`246_*` + the five `20260507*`). Verified — staging ledger confirms only those 6 lack a prod-applicable equivalent in the timestamped form, _assuming_ prod's ledger looks like staging's. (See §2 caveat.)

---

## 6. Recommended Replacement Runbook

This replaces §6 of the original plan. Phases unchanged from the original are not repeated; phases I've revised are spelled out.

### Phase 0 — Pre-flight (read-only, must complete before any GO)

Same as original §4, **plus**:

- ➕ Run this exact query against prod (`nbecbsbuerdtakxkrduw`):
  ```sql
  SELECT version, name
  FROM supabase_migrations.schema_migrations
  ORDER BY version DESC
  LIMIT 200;
  ```
  Save full output. **Do not proceed past pre-flight without this output.**
- ➕ Diff the full output against `ls supabase/migrations/`. Build a CSV: `filename`, `file_version` (numeric prefix), `ledger_version_for_same_name` (lookup by `name LIKE …`), `match_type ∈ {numeric, timestamp, missing}`.
- ➕ Confirm Supabase plan tier from the Dashboard. Pro gives PITR; Free does not.
- ➕ Verify the homepage state on prod (anon load of `https://swavleba.ge`, check for `ActiveProjectsCarousel`).

### Phase A — Safety net (zero data writes)

Per original §6 Phase A. **Replace** A2 with:

- ➕ A2-revised: take a **Supabase Dashboard backup snapshot** rather than `pg_dump` over IPv6. If on Pro, also note the PITR window and a wall-clock anchor before each subsequent phase. Only fall back to `supabase db dump --linked` if the Dashboard route is unavailable. **Never** use raw `pg_dump` against the prod URL on this stack without first verifying IPv4/IPv6 reachability.

### Phase B — Migration ledger reconciliation (REVISED)

> The original §6 Phase B assumes prod ledger uses numeric versions. That is the unverified assumption.

Two branches:

- **B-IF prod ledger uses timestamps (matches staging pattern):**
  - **Do not** call `supabase migration repair`. The ledger is internally consistent.
  - Skip directly to Phase D, but **use `mcp__supabase__apply_migration` (or Dashboard SQL editor) one migration at a time**, never `supabase db push`. The CLI cannot tell that `205_free_project_lecturers.sql` and ledger entry `20260504125921 free_project_lecturers` are the same migration.
- **B-IF prod ledger uses numeric versions (only `205`–`245` and missing 6 net-new):**
  - Original §6 Phase B is fine. `migration repair --status applied <version>` for any missing entries. Then `supabase db push` will apply only the 6 net-new.
- **B-IF mixed:** reconcile case by case. Don't run `supabase db push` until every file in `supabase/migrations/` either (a) has its filename prefix recorded as a ledger version, or (b) has a corresponding timestamp ledger entry that references the same `name`. For (b), do **not** repair as `applied` (that creates a duplicate); just verify the migration is genuinely already in the DB by inspecting the objects it creates.

### Phase C — Test net-new migrations on a Supabase branch (per original)

`mcp__supabase__create_branch` creates a copy-on-write clone of the parent project. Apply only the 6 net-new migrations there, validate, then delete the branch.

⚠️ Caveat I'm not sure about: I don't know whether Supabase branching is available on this project's plan tier. The plan assumes Pro. Verify in the Dashboard before relying on this phase.

### Phase D — Apply the 6 net-new migrations to prod (REVISED)

- If §B-IF "timestamps" applies (most likely): apply each of the 6 migrations via `mcp__supabase__apply_migration` with the file's existing version string (e.g. version `246` for `246_restore_check_is_admin_anon_execute.sql`, version `20260507151753` for `20260507151753_withdrawal_iban_guard.sql`). Capture the output for each.
- If §B-IF "numeric" applies: `supabase db push` is fine.
- After each application, run `mcp__supabase__get_advisors(type='security')` and diff against the pre-deploy baseline.

Apply order should be the file's natural order (the 6 are independent, but `246_*` is the homepage fix and should go first if the homepage is currently broken).

### Phase E — Edge functions (per original, with new caveats)

- ➕ Decide what to do about `friend-requests` and `blocked-users` (the legacy v1 functions on staging that look superseded by `friends/`). If they're meant to be deleted, that's a separate ticket — don't delete during this deploy.
- Deploy order from original is fine. Add: verify `friends/` does not regress any existing client calling `friend-requests`.

### Phase F — Env vars + code merge (per original)

- ➕ Set the 6 new env vars **before** the code deploy. The plan already says this; reinforcing because admin email manager and `/health` will 5xx without them.
- ➕ Keep `TEAM_ACCESS_KEY` set for one deploy cycle as a hot-revert safety net (per original — good call).

### Phase G — Smoke + monitor (per original)

Add to Tier 1:

- ➕ Hit `/admin/lecturer-approvals` as admin (commit `eb9a83c`).
- ➕ Hit a _different_ user's profile from a logged-in student session — verifies the broad-read drop did not break friend/peer profile views.

---

## 7. Open Questions That Must Be Answered Before GO

In addition to the 10 in the original §9:

11. ➕ **What does the prod `supabase_migrations.schema_migrations` table actually contain?** Until you produce the rows, every "ledger reconciliation" plan is theoretical.
12. ➕ **Is `friends/` intended to replace `friend-requests` and `blocked-users` edge functions, or coexist?**
13. ➕ **Is the homepage currently broken for anon on prod?** (Same as original Unknown #2; bumped in priority.)
14. ➕ **Has anyone been pushing migrations to prod via Dashboard SQL editor recently?** That is the most likely source of the numeric-vs-timestamp version drift.

---

## 8. Honesty Statement

What I am **100% sure** of:

- The git diff stats above (verified by `git diff --stat`).
- The list of files differing between `origin/main` and `origin/staging` (verified by `git diff --stat`).
- The 6 new env vars in `.env.example` (verified by `git diff -- .env.example`).
- The 13 differing edge function files (verified file-by-file).
- The structure of the **staging** migration ledger (verified via `mcp__supabase__list_migrations`).

What I am **NOT 100% sure** of, and have flagged inline:

- The contents of the **production** migration ledger. The MCP available in this session is bound to staging.
- Whether `https://swavleba.ge` homepage is currently broken (would need a live anon load, with output I trust).
- Whether `supabase db push` against prod is safe — depends entirely on the prod ledger contents.
- Whether the PITR window is currently configured on the prod Supabase project.

I have not modified any file, run any DDL, deployed any function, or touched any env var. This document is read-only output.
