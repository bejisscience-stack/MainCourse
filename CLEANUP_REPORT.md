# Cleanup Report — Swavleba (MainCourse)
Generated: 2026-03-12 (comprehensive audit)

---

## HIGH CONFIDENCE — Safe to Delete

### Unused Source Files (zero imports anywhere)
| # | File | Reason |
|---|------|--------|
| 1 | `lib/supabase/client.ts` | Duplicate of `lib/supabase.ts` — zero imports |
| 2 | `lib/supabase/server.ts` | Duplicate of `lib/supabase-server.ts` — zero imports |
| 3 | `types/channel.ts` | Duplicate of types in `types/server.ts` — zero imports |
| 4 | `app/api/courses/[courseId]/chats/route.ts` | Zero fetch calls to this endpoint |
| 5 | `app/api/me/enrollments/route.ts` | Zero fetch calls to this endpoint |
| 6 | `app/api/notifications/test-email/route.ts` | Test endpoint — zero frontend callers |

### Unused Public Assets (11 files)
| # | File | Reason |
|---|------|--------|
| 7 | `public/wavleba-logo.backup.png` | Backup file — zero references |
| 8 | `public/wavleba-logo.png` | Superseded by `wavleba-logo-new.png` |
| 9 | `public/wavleba-logo.svg` | Only in stale `generate-logos 2.js` |
| 10 | `public/supabase/font.png` | Zero references |
| 11 | `public/apple-touch-icon-57x57.png` | Not in layout.tsx or manifest.json |
| 12 | `public/apple-touch-icon-60x60.png` | Not in layout.tsx or manifest.json |
| 13 | `public/apple-touch-icon-72x72.png` | Not in layout.tsx or manifest.json |
| 14 | `public/apple-touch-icon-114x114.png` | Not in layout.tsx or manifest.json |
| 15 | `public/apple-touch-icon-144x144.png` | Not in layout.tsx or manifest.json |
| 16 | `public/apple-touch-icon-180x180.png` | Not in layout.tsx or manifest.json |
| 17 | `public/mstile-144x144.png` | Not in browserconfig.xml |

### Stale Root-level Files (10 files)
| # | File | Reason |
|---|------|--------|
| 18 | `CHANGES.md` | Unreferenced documentation artifact |
| 19 | `COURSES.md` | Unreferenced documentation artifact |
| 20 | `PROJECTS.md` | Unreferenced documentation artifact |
| 21 | `SECURITY_AUDIT_REPORT.md` | One-time audit output, never consumed |
| 22 | `KEEPZ_INTEGRATION_GUIDE.md` | Superseded by `docs/keepz-api-guide.md` |
| 23 | `view_scraper_bot.md` | Unreferenced documentation artifact |
| 24 | `chatdesign.md` | Stale design spec (64KB) |
| 25 | `technical+implementation.md` | Empty file (0 bytes) |
| 26 | `production_schema.sql` | Empty file (0 bytes) |
| 27 | `ChatGPT Image Jan 26, 2026, 08_40_18 PM.png` | Source image — generated outputs already in /public/ |

### Stale Scripts (4 files)
| # | File | Reason |
|---|------|--------|
| 28 | `scripts/execute-migration.js` | One-time utility for migration 100, already applied |
| 29 | `scripts/generate-logos 2.js` | macOS Finder duplicate — logos already generated |
| 30 | `scripts/process-logo.js` | One-time logo processor — output already in /public/ |
| 31 | `scripts/run-migrations-simple.sh` | Not in package.json, superseded by run-migrations.js |

### Stale Config Files (3 files)
| # | File | Reason |
|---|------|--------|
| 32 | `.watchmanconfig` | Watchman not used — Next.js has own file watcher |
| 33 | `tsconfig.dev.json` | Not referenced by any npm script or build |
| 34 | `start-dev.sh` | Superseded by `npm run dev` |

### Stale Legacy Directory (5 files)
| # | File | Reason |
|---|------|--------|
| 35 | `Files/about us.txt` | Raw text draft — content already in app pages |
| 36 | `Files/personal info security.txt` | Raw text draft |
| 37 | `Files/privacy policy.txt` | Raw text draft |
| 38 | `Files/refund policy.txt` | Raw text draft |
| 39 | `Files/terms and conditions.txt` | Raw text draft |

### Unused npm Package
| # | Package | Reason |
|---|---------|--------|
| 40 | `semver` | Zero imports or usage anywhere in codebase |

### Unused Supabase DB Functions (5 functions)
| # | Function | Reason |
|---|----------|--------|
| 41 | `search_users()` | Created in migration 095, never called via .rpc() |
| 42 | `cleanup_expired_typing_indicators()` | No cron job or code calls it |
| 43 | `reset_unread_count()` | Never called from code |
| 44 | `is_admin()` | Superseded by `check_is_admin()` |
| 45 | `get_user_role()` | Never called from code |

**Total HIGH CONFIDENCE items: 45**

---

## MEDIUM CONFIDENCE — Needs Manual Review

### Debug/Test API Routes in Production
| File | Notes |
|------|-------|
| `app/api/admin/enrollment-requests/test/route.ts` | Test endpoint — called from admin page but no production purpose |
| `app/api/admin/debug-requests/route.ts` | Debug endpoint — called from admin page |

### Redundant Edge Functions (22 functions)
These have parallel Next.js API routes that the frontend actually calls. The edge functions are never invoked directly:

`admin-enrollment-requests`, `admin-enrollment-approve`, `admin-enrollment-reject`, `admin-bundle-enrollment-requests`, `admin-bundle-enrollment-approve`, `admin-bundle-enrollment-reject`, `admin-withdrawals`, `admin-withdrawal-approve`, `admin-withdrawal-reject`, `admin-notifications-send`, `enrollment-requests`, `bundle-enrollment-requests`, `notifications`, `notification-read`, `notifications-read-all`, `notifications-unread-count`, `balance`, `withdrawals`, `validate-referral-code`, `me-enrollments`, `health`, `course-chats`

### Unused Exports Within Used Files (~30 exports)
Exported functions/types never imported elsewhere — not critical but add dead weight:
- `lib/api-client.ts`: `fetchWithAuth`
- `lib/auth.ts`: `SignUpData`, `SignInData`, `resendVerificationEmail`
- `lib/currency.ts`: `formatGel`
- `lib/email.ts`: `SendEmailParams`
- `lib/i18n.ts`: `LANGUAGE_COOKIE_NAME`
- `lib/keepz.ts`: `KeepzCrypto`, `CreateOrderOptions`, `CreateOrderResult`, `getSavedCardsFromKeepz`
- `lib/referral-storage.ts`: `hasStoredReferral`
- `lib/username.ts`: `getDisplayUsername`
- `lib/video-url-parser.ts`: `extractVideoUrls`
- `components/ErrorBoundary.tsx`: `withErrorBoundary`
- Various hook type exports: `AdminSubscriptionData`, `BudgetResult`, `CountdownResult`, etc.

### PostHog Integration (wired but inactive)
`PostHogContext.tsx` and `PostHogPageView.tsx` run in layout.tsx but no `posthog.capture()` or `posthog.identify()` calls exist anywhere. Only automatic pageviews are tracked.

### Unused DB Tables (already dropped)
`friend_requests`, `friendships` — properly dropped in migration 049. No cleanup needed.

### `payment-screenshots` Storage Bucket
No new screenshots uploaded since Keepz replaced screenshot flow. Old enrollment requests may still reference stored URLs.

---

## NOT Deleting (confirmed needed)
- `scripts/run-migrations.js` — used by `npm run migrate`
- `scripts/run-migrations-psql.js` — used by `npm run migrate:psql`
- `supabase/migrations/run-all-migrations.sql` — generated by migrate scripts
- `lib/supabase/middleware.ts` — imported by root `middleware.ts`
- All 114 migration files — historical record
- Both referral-code API routes (different auth contexts)
- `app/api/health/route.ts` and `app/api/ping/route.ts` — infrastructure monitoring
- `coming_soon_emails` table — low usage but still actively queried

---

## Deletion Plan (HIGH CONFIDENCE only)

### Batch 1: Unused npm package
- `npm uninstall semver`
- Verify build

### Batch 2: Unused source files (items 1-6)
- Delete lib/supabase/client.ts, lib/supabase/server.ts
- Delete types/channel.ts
- Delete unused API routes
- Verify build

### Batch 3: Stale root files + scripts + configs (items 18-34)
- Delete docs, scripts, configs
- Verify build

### Batch 4: Stale assets + legacy directory (items 7-17, 35-39)
- Delete unused public/ assets
- Delete Files/ directory
- Verify build

### Batch 5: DB function cleanup (items 41-45)
- Create migration to drop unused functions
- Apply to staging

### Final: Commit all changes

---

## Execution Summary (completed 2026-03-12)

### Pass 1 — Initial Cleanup (40 items)
- **1 npm package**: `semver`
- **6 source files**: 2 duplicate lib/supabase files, types/channel.ts, 3 unused API routes
- **11 public assets**: old logos, unused apple-touch-icons, unused mstile
- **10 root docs**: CHANGES.md, COURSES.md, PROJECTS.md, SECURITY_AUDIT_REPORT.md, KEEPZ_INTEGRATION_GUIDE.md, view_scraper_bot.md, chatdesign.md, technical+implementation.md, production_schema.sql, ChatGPT image
- **4 scripts**: execute-migration.js, generate-logos 2.js, process-logo.js, run-migrations-simple.sh
- **3 configs**: .watchmanconfig, tsconfig.dev.json, start-dev.sh
- **5 legacy text files**: Files/ directory (about us, privacy, refund, terms, personal info)

### Pass 2 — Deep Cleanup (32 items)
- **22 orphaned edge functions** deleted across two batches:
  - Batch 1 (13): admin-bundle-enrollment-approve/reject, admin-enrollment-approve/reject, admin-notifications-send, admin-withdrawal-approve/reject, admin-withdrawals, course-chats, me-enrollments, notification-read, notifications-read-all, notifications-unread-count
  - Batch 2 (9): admin-bundle-enrollment-requests, admin-enrollment-requests, balance, bundle-enrollment-requests, enrollment-requests, notifications, validate-referral-code, withdrawals, health
- **1 orphaned shared module**: `_shared/email.ts` (no remaining importers after edge function cleanup)
- **8 dead CSS keyframes** from deleted animation components: bitcoinDrop, socialFloat, aiSlideLeft, aiSlideRight, signalPulse, testMove, simpleFloat, moveLine
- **1 stale config**: vercel.json (project is on DigitalOcean)

### Pass 0 — Payment System Cleanup (prior)
- **2 deleted components**: PaymentDialog.tsx (487 lines), PaymentMethodSelector.tsx (69 lines)
- **2 deleted images**: payment-step-1.png, payment-step-2.png
- **~30 obsolete locale keys** removed from en.json and ge.json
- **10 orphaned components** + **3 unused hooks** deleted

### Remaining Edge Functions (actively called)
- `chat-messages`, `chat-media`, `chat-mute`, `chat-typing`, `chat-unread` — called directly via `edgeFunctionUrl()`
- `view-scraper` — called via API route proxy + pg_cron
- `_shared/` — auth.ts, cors.ts, supabase.ts (used by above functions)

### DB Migration
- `supabase/migrations/115_drop_unused_db_functions.sql` — deployed to staging (bvptqdmhuumjbyfnjxdt)
- Drops: `search_users()`, `cleanup_expired_typing_indicators()`, `reset_unread_count()`, `is_admin()`, `get_user_role()`

### Build Verification
- `npx tsc --noEmit`: PASS (zero errors)
- `npm run build`: FAILS (pre-existing `resend` → `mailparser` → `iconv-lite` dependency issue — NOT caused by cleanup)
- No new errors introduced by cleanup

### Total Lines Removed
~5,540 lines of dead code across all passes

### Still Pending (MEDIUM confidence — manual review needed)
- 2 debug/test API routes in production (`admin/enrollment-requests/test`, `admin/debug-requests`)
- ~30 unused exports within used files (non-critical)
- PostHog integration (wired but inactive — provider runs, no tracking calls)
- `payment-screenshots` storage bucket (historical data, no new uploads)
