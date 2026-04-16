# Swavleba Production Export — 2026-03-14

Full read-only snapshot of the production system: git codebase (`main` branch) + Supabase production (`nbecbsbuerdtakxkrduw`).

---

## Table of Contents

1. [Git Summary](#1-git-summary)
2. [Codebase Inventory](#2-codebase-inventory)
3. [Full Commit History](#3-full-commit-history)
4. [Database Tables & Columns](#4-database-tables--columns)
5. [RLS Policies](#5-rls-policies)
6. [Database Functions / RPCs](#6-database-functions--rpcs)
7. [Triggers](#7-triggers)
8. [Indexes](#8-indexes)
9. [Foreign Key Constraints](#9-foreign-key-constraints)
10. [Storage Buckets & Policies](#10-storage-buckets--policies)
11. [Extensions](#11-extensions)
12. [Cron Jobs](#12-cron-jobs)
13. [Realtime Publications](#13-realtime-publications)
14. [Edge Functions](#14-edge-functions)
15. [Applied Migrations (Supabase)](#15-applied-migrations-supabase)

---

## 1. Git Summary

| Metric                | Value                                |
| --------------------- | ------------------------------------ |
| Branch                | `main`                               |
| Latest commit         | `b15dad9` — "Merge branch 'staging'" |
| Total commits         | **281**                              |
| Total tracked files   | **435**                              |
| Lines of code (TS)    | **18,149**                           |
| Lines of code (TSX)   | **31,369**                           |
| Lines of code (SQL)   | **9,683**                            |
| **Total LOC**         | **59,201**                           |
| Remote                | `origin/main` (in sync)              |
| Staging ahead of main | **68 commits**                       |

### Branch State

- `main` ↔ `origin/main`: in sync
- `staging` ↔ `origin/staging`: in sync
- `staging` is 68 commits ahead of `main`
- 25 `security/*` feature branches (from security audit)
- 6 `worktree-agent-*` branches (all point to `b15dad9`)

---

## 2. Codebase Inventory

| Directory                   | Count | Description                                                                                   |
| --------------------------- | ----- | --------------------------------------------------------------------------------------------- |
| `supabase/migrations/*.sql` | 105   | SQL migration files                                                                           |
| `supabase/functions/`       | 28    | Edge function directories (+ `_shared/`)                                                      |
| `app/api/**/route.ts`       | 45    | API route handlers                                                                            |
| `components/**/*.tsx`       | 70    | React components (41 top-level + 15 chat/ + 7 backgrounds/ + 5 enrollment/ + 1 ui/ + 1 other) |
| `hooks/*.ts`                | 45    | Custom React hooks                                                                            |
| `contexts/`                 | 4     | Context providers (Background, I18n, PostHog, Theme)                                          |
| `locales/`                  | 2     | Locale files (en.json, ge.json)                                                               |
| `lib/`                      | 17    | Library/utility files                                                                         |
| `app/**/page.tsx`           | 23    | Page routes                                                                                   |

### Shared Edge Function Utilities (`_shared/`)

- `auth.ts` — `getAuthenticatedUser(req)` helper
- `cors.ts` — CORS headers
- `email.ts` — Resend email helper
- `supabase.ts` — Supabase client factory

### Import Map (`supabase/functions/import_map.json`)

```json
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.98.0",
    "resend": "https://esm.sh/resend@2"
  }
}
```

---

## 3. Full Commit History

All 281 commits on `main` (newest first):

```
b15dad9 Merge branch 'staging'
edf984d Remove YouTube/Facebook platforms, keep only Instagram and TikTok
5ca6890 Add YouTube/Facebook platform support and date column to view bot dashboard
bba303b View bot dashboard improvements, platform URL validation, launch date update
f20cf6b Fix approved subscription not granting project access
6f8878d Add subscription_approved/rejected to notifications type constraint
530c6a0 Fix project subscription RPCs: use correct create_notification signature
146e714 Fix admin subscriptions API: use separate queries instead of broken FK join
d9cfe3e Fix admin project subscriptions: broken FK join + missing auth on approve/reject
7ed7a0e Fix project access: base expiry on registration date, remove global grant from enrollment
8d8776f Fix view scraper: switch to paid TikTok actor + add run button locking
ce4902f Fix view scraper 401s: redeploy with --no-verify-jwt + error feedback + text visibility
9b3a610 Fix view scraper: surface Apify actor errors + fix dashboard text visibility
98f2b9d Fix view scraper: robust metric extraction for Apify schema changes
0f300e1 Fix view bot admin: use correct column name (name instead of title) for projects
986166d Add view scraper system, admin RLS fixes, and project access reply policy
f339d7b Fix view bot admin: remove broken FK join for profiles
2059d41 Fix missing auth headers in admin view scraper and project subscription hooks
e1a10bd Fix infinite loop on chat page for project-access-only users
05c07b5 Fix infinite refresh loop and missing auth in project access hook
0935eff Replace Enroll in Course with project access/subscription flow on project details
17ae007 Add missing view scraper files from schedule management feature
782784f Grant 1-month project access on registration
44e9caf Add view scraper schedule management UI
d9aafd4 Fix VideoSubmissionDialog auth with session refresh fallback
b7286a4 Fix edge function 401 auth by passing token to getUser explicitly
22779d3 Remove temporary migration documentation
7e50bc7 Document Supabase authentication setup and migration procedures
0fa37b9 Document pending Supabase migration for lecturer upload fix
5c9e761 Fix lecturer upload RLS and remove file size limits
732b53d Add isEnrollmentExpired calculation from isEnrolledInCourse
7ae9b29 Fix theme property access: use theme.theme === 'dark' instead of theme.isDark
bf52c08 Fix POST method createServerSupabaseClient call to pass token argument
54720eb Fix createServerSupabaseClient() calls with missing token argument
c00e211 Fix import errors and type issues
900c616 Fix ProjectSubscriptionModal: use sonner toast and inline modal/button components
8aa89c3 Implement project subscription system + course lifetime access + bug fixes
4f2e890 Merge branch 'staging'
ad8a221 Fix messenger alignment by adding user null-guard in chat pages
682abc7 Add messenger-style own message alignment (right side with bubble)
6636354 Merge branch 'staging'
cef8cb4 Fix VideoPlayer mobile UX: touch controls and responsive layout
8f255d6 Fix profile display timeout and video fullscreen CSS transform issues
ac99fa7 Add missing update_own_profile RPC function for profile updates
3a19564 Merge branch 'staging'
f33213e Replace desktop projects carousel with circular 3D ring gallery
e2d59aa Merge branch 'staging'
cb97086 Replace desktop carousel with circular 3D ring gallery
e24364d Merge branch 'staging'
39cc14b Add custom VideoPlayer component with animated controls
f6b80e0 Fix otp_expired error: verify recovery token client-side
05c9b7e Fix otp_expired error: verify recovery token client-side
22d9e59 Merge branch 'staging'
f48379e Fix recovery callback: hardcode /reset-password redirect and use token_hash flow
5b239a6 Merge staging into main
c0e049c Add PostHog analytics integration
f4513d4 Fix recovery redirect: detect recovery sessions without query params
4e1a65a Add forgot password and reset password flow
e41e7d4 Fix duplicate auth keys in locale files and add forgot/reset password translations
e704fd3 Translate remaining hardcoded strings in complete-profile page
5e5c010 Add Google OAuth authentication with profile completion flow
ae64e26 Add CLAUDE.md to staging branch
227541c Restore production .project-ref and update CLAUDE.md
0087fd1 Merge branch 'staging'
d1dbf23 Add .mcp.json to gitignore to protect access tokens
44fa9af Update profile dropdown UI and lazy-init Resend client
b5f933c Configure staging branch with dedicated Supabase project
043832c Final Fix For Profiles
3e9a088 Fixed Profile Icon
511f001 Made Profile Updates
257d469 Made Profile Updates
5aee868 Made Fixes
83f83e3 Made Chat Better
efaacec Added projects
04dc0cd Added language switcher
7ba330b Fixed EMails
6fd9cf0 Fixed EMails
d6a2b85 Fixed EMail Notifs
2ebeb5e Add admin email notifications via Resend alongside in-app notifications
03d03ee Add no-cache headers to fix coming-soon page not appearing on all devices
ca05431 Set team access cookie to 15-minute expiry instead of session-based
ffb0bdd Make coming-soon access session-only, invalidate old persistent cookies
d9714f4 Restore coming-soon redirect for all users (revert localhost bypass)
3e1a863 Revert codebase to commit 7f7dc93 (Trigger rebuild - Fixed Charts)
80cde72 Fixed friend requests and returned countdown
c9c6b3b Made Final Update For Friend Requests
c8fe726 Final Fix For Friends
69cf938 Final Fix For Friends
c5b3774 Fixed Final
8664848 Fixed Friends Requests
0a11fc9 Friends Functionality Added
ad5d39e Added friends functionality
7f7dc93 Trigger rebuild - Fixed Charts
c23271a Fix Tooltip formatter type compatibility with Recharts
28620fa Fix TypeScript error in AdminAnalytics Tooltip formatter
5569064 Merge branch 'main' of https://github.com/bejisscience-stack/MainCourse
9f0fba4 Made Analytics On Admin
7bd8e46 Fix coming-soon countdown to target March 11, 2026 Georgia time
dbdffbc Fix countdown to use fixed launch date (March 11, 2026)
b67e0f6 Small Updates
6fb3e07 Add coming soon page with countdown and email collection
3aaf92a Fix: Require payment for course re-enrollment
2699070 Fixed Projects Part
b2a9ca8 Video Updated
9b42ca0 Fix: Display actual GEL prices without 2.5x conversion
44e5ade UPD 7
f94b6e0 UPD 6
567f41a UPD 5
1764e73 UPD 4
de0e21d UPD 3
6b4153a UPD 2
22d8b87 UPD 1
af62b9f Made Ui Changes For Mobile Devices
3d78643 Fixed Notifications
f9eaec9 Made Final Changes
3754db7 Final Polir
5b49a80 fixed Deployment Issues
9715620 Made Final UI Changes
2c058db Made UI Changes
9b911a9 Final Favicon
55eaae4 Favicon
ebbb1c9 Favicon Fixed Again
eb7a207 Favicon Fixed
696432a Fixed Logo
199a112 Use NODE_ENV to determine base URL instead of hostname check
6c0ed92 Fix callback redirects to use production URL
dbe86b8 Fix Supabase client initialization with proper error handling
48a3231 Hardcode production URL for email redirects
4bf5d26 Remove Unnecessary Files
c4e6d03 fixed email
245e3e0 INcreased Video Sizs
cdcbc2e Fix clearReferral call to use new signature (no arguments)
9a535a9 Remove course-specific referral codes, keep only general referrals
559550f Fixed UI
8079faf Add persistent referral code storage (30-day expiration)
fc227c4 Fixed Referral code validation on signup page
2c62d09 Fixed UI v2
8ac46e0 Made UI Changes
53c6acf Migrate chat backend to Supabase Edge Functions
2a8564c Fixed Bugs
188bf15 Updated logo to match uploaded image - Cash App style dollar sign, transparent background
bbe205d Updated logo with new design - transparent background, clean style
c4ffb41 Logo Fixed
9493777 Fixed Logo & Referal Codes - Use SVG for logo, fix favicon transparency
93569d3 Fixed Logo & Referal Codes
b2a5980 Fix logo display - remove drop-shadow causing white box effect
609088d made UI Updates
30c4b15 Update Wavleba logo with new image
1146567 Saved New Logo
bedec7a Update Wavleba logo
49ad6b4 Made UI Updates
b20aa03 Fix enrollment dialog close functionality
3386118 Use window.location.href for reliable redirect navigation
a81e330 Fix CourseCard to redirect to signup for unauthenticated users
d711d81 Redirect to signup instead of login for unauthenticated users
704f2d1 Fixed unregistered user enrollment redirect
17397f5 Fixed Stiff
5a54e92 Fixed Pending Withdrawals
a5c7774 fixed deployment issues
9ea8946 Fix payment-screenshots bucket policies and add api-client
548617a Add all Supabase Edge Functions
a774b6c Fixed 4 Bugs
2032195 Remove test file
116906c Test Commit
3cfea0a TTT
d2e4daa Replace broken RPC calls with SERVICE ROLE direct queries
27ac3de Fix pending requests not visible on admin dashboard
c7f5062 OOOO
616dd46 TTTT
251793f GGGG
a195be3 Fixed Withdrawals
0154579 Fixed Admin Dashboard
6b2ac8a Fixed Email
31ba7f4 Fixed Notification Panel
5dae94a Fixed Chat Layout
d03e64c Increase chat message width constraints for better space utilization
f9f4977 Restore chat UI to exact state from commit b978770
1a14f5f Restore chat UI to match working version
20686e2 Fix TypeScript error: use async IIFEs instead of .then().catch()
bd09ecd Fixed Chat and Performance
e6eb24b Fix chat page infinite refresh loop and hydration issues
0dde6ee Fix courses type in useRealtimeEnrollmentRequests
e0e2b2d Fix bundles type in useRealtimeBundleEnrollmentRequests
c41e8ec Fix profiles type in useRealtimeAdminWithdrawalRequests
6c5f077 Fix profiles type: use undefined instead of null
ff0752d Fix TypeScript error in useRealtimeAdminEnrollmentRequests
b31784f Fix TypeScript error in useRealtimeAdminBundleEnrollmentRequests
3126459 Fixed Most Bugs
b978770 Added Monthly Subscription & No Reload Needed
fe3f2f2 Added Notifications
4fa013c Fixed Project Dialog
74e8074 Redesign project cards with countdown timer and budget tracking
16a4eb7 Fixed Deployment
a76e7af Add active projects feature and cleanup documentation
dfeeb64 Fixed Founded Bugs
e995840 More BUgs Fixed
6d6c1dd Bugs Fixed
634f98e Initial commit: MainCourse platform with enhanced course type visibility
91f6c19 Fixed Fourth&Fifth Bugs
e571358 Third Bug Fixed
8ef6046 Second Bug Fixed
5b7ec31 First Bug Fixed
47352f4 Checkpoint XZ
711186d tt7
e62ef64 tt6
d659cc1 tt5
615192b tt4
3f06561 tt3
8fa7db4 tt2
7348063 tt1
b1e4a2c tt
fc8c8b1 stuff updated
df6daf8 Fixed Profile
128284e Fix: Add optional platform property to ProjectCriteria interface
fc575e9 Fix: Reorder function declarations to fix variable used before declaration
2be5dbf Fix: Convert promise chain to async/await in CourseCreationModal
45ec53f Fix: Add type annotations to map callbacks in test route
be73485 Fix: Remove invalid .catch() on Supabase RPC call
81554cc Fix: Replace course.instructor with course.author in admin page
fc6f445 Save 2
4d7107e Referal Links
77904d4 Save 1
56a453c Save
127e5e8 Animations added
8189b79 Chat Improved
f3e9058 Fixed Stuff
b6d073e fixed dialog
d1a9dd2 Visual Update
a3d9544 Checkpoint 000
f401358 Updated Bundle Approvals
cdf4d7c Added stuff
584bb85 Added stuff
e8a5b50 added more translateions
a77c64e Translated To Georgian
8679256 bundles added
7b98d03 asdas
cc08253 fixed s
b5c5898 Fixed Stuff
5a83217 Added Date Selector to Projects
e63d62c Chat loading fixed
72ab45a user can no longer create projects
7244f92 fixed username issue
44278b1 Projects Added
6e2a3fc Removed Friends
4013c4a Removed Friends
ca4a84a Fixed Friends Name Visibility
9836eaf New Checkpoint
1df5991 fixed Chat delay
090f724 Hard Updates
50a0103 big update
be4f3d7 nnn
5ec95e8 Hard Reset
ea98065 Checkpoint 25
affd9fd Checkpoint 24
4824806 Checkpoint 23
87061d4 Checkpoint 22
1d0b506 Checkpoint 21
cd55e60 Checkpoint 20
2b55e74 Checkpoint 19
71bdc37 Checkpoint 18
1bd424a Checkpoint 17
2cbd24e Checkpoint 16
ea288e3 Checkpoint 15
90a7cd5 Checkpoint 14
084e72f Checkpoint 13
bc015a0 Checkpoint 12
30aaf88 Checkpoint 11
1911d70 Checkpoint 10
13b4159 Checkpoint 9
41c7526 Checkpoint 8
206e2eb Checkpoint 7
0150542 Checkpoint 6
d9e82f5 Checkpoint 5
024be89 fixed intro video & thumbnail uploads
01f5147 fixed loading issues
218046a Third Checkpoint
734e322 Second Checkpoint
19611a2 Checkpoint 1
9b72cd0 first commit
e347154 initial Commit
d7f3336 Initial commit: Modern landing page with navy theme, responsive design, and Supabase integration
```

---

## 4. Database Tables & Columns

Production has **34 tables/views** with **309 columns** total.

### `active_services_view` (VIEW)

| Column         | Type        | Nullable | Default |
| -------------- | ----------- | -------- | ------- |
| id             | uuid        | YES      | —       |
| name           | varchar     | YES      | —       |
| description_en | text        | YES      | —       |
| description_ka | text        | YES      | —       |
| description_ru | text        | YES      | —       |
| photos         | ARRAY       | YES      | —       |
| created_at     | timestamptz | YES      | —       |
| updated_at     | timestamptz | YES      | —       |

### `balance_transactions`

| Column         | Type        | Nullable | Default            |
| -------------- | ----------- | -------- | ------------------ |
| id             | uuid        | NO       | uuid_generate_v4() |
| user_id        | uuid        | NO       | —                  |
| user_type      | text        | NO       | —                  |
| amount         | numeric     | NO       | —                  |
| type           | text        | NO       | —                  |
| source         | text        | NO       | —                  |
| reference_id   | uuid        | YES      | —                  |
| reference_type | text        | YES      | —                  |
| description    | text        | YES      | —                  |
| balance_after  | numeric     | NO       | —                  |
| created_at     | timestamptz | YES      | now()              |
| updated_at     | timestamptz | YES      | now()              |

### `bundle_enrollment_requests`

| Column              | Type        | Nullable | Default   |
| ------------------- | ----------- | -------- | --------- |
| id                  | uuid        | NO       | PK        |
| user_id             | uuid        | NO       | —         |
| bundle_id           | uuid        | NO       | —         |
| status              | text        | YES      | 'pending' |
| created_at          | timestamptz | YES      | —         |
| updated_at          | timestamptz | YES      | —         |
| reviewed_by         | uuid        | YES      | —         |
| reviewed_at         | timestamptz | YES      | —         |
| payment_screenshots | ARRAY       | YES      | —         |

### `bundle_enrollments`

| Column     | Type        | Nullable | Default |
| ---------- | ----------- | -------- | ------- |
| id         | uuid        | NO       | PK      |
| user_id    | uuid        | NO       | —       |
| bundle_id  | uuid        | NO       | —       |
| created_at | timestamptz | YES      | —       |

### `channels`

| Column       | Type        | Nullable | Default |
| ------------ | ----------- | -------- | ------- |
| id           | uuid        | NO       | PK      |
| course_id    | uuid        | NO       | —       |
| name         | varchar     | NO       | —       |
| description  | text        | YES      | —       |
| is_default   | boolean     | YES      | false   |
| channel_type | text        | YES      | 'text'  |
| created_at   | timestamptz | YES      | —       |
| updated_at   | timestamptz | YES      | —       |
| position     | integer     | YES      | 0       |

### `coming_soon_emails`

| Column     | Type        | Nullable | Default |
| ---------- | ----------- | -------- | ------- |
| id         | uuid        | NO       | PK      |
| email      | varchar     | NO       | UNIQUE  |
| created_at | timestamptz | YES      | —       |

### `course_bundle_items`

| Column     | Type        | Nullable | Default |
| ---------- | ----------- | -------- | ------- |
| id         | uuid        | NO       | PK      |
| bundle_id  | uuid        | NO       | —       |
| course_id  | uuid        | NO       | —       |
| created_at | timestamptz | YES      | —       |

### `course_bundles`

| Column         | Type        | Nullable | Default |
| -------------- | ----------- | -------- | ------- |
| id             | uuid        | NO       | PK      |
| name           | varchar     | NO       | —       |
| name_ge        | varchar     | YES      | —       |
| description    | text        | YES      | —       |
| description_ge | text        | YES      | —       |
| price          | numeric     | NO       | —       |
| is_active      | boolean     | YES      | true    |
| created_at     | timestamptz | YES      | —       |
| updated_at     | timestamptz | YES      | —       |

### `courses`

| Column              | Type        | Nullable | Default |
| ------------------- | ----------- | -------- | ------- |
| id                  | uuid        | NO       | PK      |
| title               | varchar     | NO       | —       |
| description         | text        | YES      | —       |
| description_ge      | text        | YES      | —       |
| price               | numeric     | YES      | 0       |
| thumbnail_url       | text        | YES      | —       |
| category            | varchar     | YES      | —       |
| status              | varchar     | YES      | 'draft' |
| created_at          | timestamptz | YES      | —       |
| updated_at          | timestamptz | YES      | —       |
| lecturer_id         | uuid        | YES      | —       |
| payment_details     | text        | YES      | —       |
| title_ge            | varchar     | YES      | —       |
| category_ge         | varchar     | YES      | —       |
| allow_keepz_payment | boolean     | YES      | false   |
| keepz_payment_url   | text        | YES      | —       |
| keepz_qr_code_url   | text        | YES      | —       |

### `dm_conversations`

| Column          | Type        | Nullable | Default |
| --------------- | ----------- | -------- | ------- |
| id              | uuid        | NO       | PK      |
| user1_id        | uuid        | NO       | —       |
| user2_id        | uuid        | NO       | —       |
| created_at      | timestamptz | YES      | —       |
| last_message_at | timestamptz | YES      | —       |

### `dm_messages`

| Column          | Type        | Nullable | Default |
| --------------- | ----------- | -------- | ------- |
| id              | uuid        | NO       | PK      |
| conversation_id | uuid        | NO       | —       |
| sender_id       | uuid        | NO       | —       |
| content         | text        | YES      | —       |
| created_at      | timestamptz | YES      | —       |
| updated_at      | timestamptz | YES      | —       |
| is_deleted      | boolean     | YES      | false   |

### `enrollment_requests`

| Column              | Type        | Nullable | Default   |
| ------------------- | ----------- | -------- | --------- |
| id                  | uuid        | NO       | PK        |
| user_id             | uuid        | NO       | —         |
| course_id           | uuid        | NO       | —         |
| status              | text        | YES      | 'pending' |
| created_at          | timestamptz | YES      | —         |
| updated_at          | timestamptz | YES      | —         |
| reviewed_by         | uuid        | YES      | —         |
| reviewed_at         | timestamptz | YES      | —         |
| payment_screenshots | jsonb       | YES      | '[]'      |
| referral_code       | text        | YES      | —         |

### `enrollments`

| Column      | Type        | Nullable | Default   |
| ----------- | ----------- | -------- | --------- |
| id          | uuid        | NO       | PK        |
| user_id     | uuid        | NO       | —         |
| course_id   | uuid        | NO       | —         |
| enrolled_at | timestamptz | YES      | —         |
| role        | varchar     | YES      | 'student' |
| created_at  | timestamptz | YES      | —         |

### `friend_requests`

| Column      | Type        | Nullable | Default   |
| ----------- | ----------- | -------- | --------- |
| id          | uuid        | NO       | PK        |
| sender_id   | uuid        | NO       | —         |
| receiver_id | uuid        | NO       | —         |
| status      | text        | YES      | 'pending' |
| created_at  | timestamptz | YES      | —         |
| updated_at  | timestamptz | YES      | —         |

### `friendships`

| Column     | Type        | Nullable | Default |
| ---------- | ----------- | -------- | ------- |
| id         | uuid        | NO       | PK      |
| user_id    | uuid        | NO       | —       |
| friend_id  | uuid        | NO       | —       |
| created_at | timestamptz | YES      | —       |

### `message_attachments`

| Column        | Type        | Nullable | Default |
| ------------- | ----------- | -------- | ------- |
| id            | uuid        | NO       | PK      |
| message_id    | uuid        | YES      | —       |
| channel_id    | uuid        | YES      | —       |
| user_id       | uuid        | NO       | —       |
| file_name     | text        | NO       | —       |
| file_type     | text        | NO       | —       |
| file_size     | integer     | YES      | —       |
| storage_path  | text        | NO       | —       |
| created_at    | timestamptz | YES      | —       |
| dm_message_id | uuid        | YES      | —       |

### `messages`

| Column      | Type        | Nullable | Default |
| ----------- | ----------- | -------- | ------- |
| id          | uuid        | NO       | PK      |
| channel_id  | uuid        | NO       | —       |
| user_id     | uuid        | NO       | —       |
| content     | text        | YES      | —       |
| created_at  | timestamptz | YES      | —       |
| updated_at  | timestamptz | YES      | —       |
| is_deleted  | boolean     | YES      | false   |
| reply_to_id | uuid        | YES      | —       |
| edited_at   | timestamptz | YES      | —       |

### `muted_users`

| Column        | Type        | Nullable | Default |
| ------------- | ----------- | -------- | ------- |
| id            | uuid        | NO       | PK      |
| user_id       | uuid        | NO       | —       |
| muted_user_id | uuid        | NO       | —       |
| context_type  | text        | NO       | —       |
| context_id    | uuid        | NO       | —       |
| created_at    | timestamptz | YES      | —       |
| muted_until   | timestamptz | YES      | —       |

### `notifications`

| Column     | Type        | Nullable | Default |
| ---------- | ----------- | -------- | ------- |
| id         | uuid        | NO       | PK      |
| user_id    | uuid        | NO       | —       |
| type       | text        | NO       | —       |
| title_en   | text        | NO       | —       |
| title_ge   | text        | NO       | —       |
| message_en | text        | NO       | —       |
| message_ge | text        | NO       | —       |
| metadata   | jsonb       | YES      | '{}'    |
| is_read    | boolean     | YES      | false   |
| created_at | timestamptz | YES      | —       |
| created_by | uuid        | YES      | —       |

### `profiles`

| Column                    | Type        | Nullable | Default   |
| ------------------------- | ----------- | -------- | --------- |
| id                        | uuid        | NO       | PK        |
| email                     | text        | YES      | —         |
| role                      | text        | YES      | 'student' |
| created_at                | timestamptz | YES      | —         |
| updated_at                | timestamptz | YES      | —         |
| avatar_url                | text        | YES      | —         |
| username                  | text        | YES      | —         |
| full_name                 | text        | YES      | —         |
| balance                   | numeric     | YES      | 0         |
| bank_account_number       | text        | YES      | —         |
| referral_code             | text        | YES      | —         |
| referred_by               | uuid        | YES      | —         |
| referred_by_code          | text        | YES      | —         |
| signup_referral_processed | boolean     | YES      | false     |
| project_access_expires_at | timestamptz | YES      | —         |
| project_access_source     | text        | YES      | —         |

### `project_criteria`

| Column     | Type        | Nullable | Default |
| ---------- | ----------- | -------- | ------- |
| id         | uuid        | NO       | PK      |
| project_id | uuid        | NO       | —       |
| title      | text        | NO       | —       |
| title_ge   | text        | YES      | —       |
| max_score  | integer     | NO       | 10      |
| position   | integer     | NO       | 0       |
| created_at | timestamptz | YES      | —       |

### `project_submissions`

| Column          | Type        | Nullable | Default   |
| --------------- | ----------- | -------- | --------- |
| id              | uuid        | NO       | PK        |
| project_id      | uuid        | NO       | —         |
| user_id         | uuid        | NO       | —         |
| youtube_url     | text        | NO       | —         |
| status          | text        | NO       | 'pending' |
| feedback        | text        | YES      | —         |
| feedback_ge     | text        | YES      | —         |
| submitted_at    | timestamptz | YES      | —         |
| reviewed_at     | timestamptz | YES      | —         |
| reviewed_by     | uuid        | YES      | —         |
| created_at      | timestamptz | YES      | —         |
| latest_views    | integer     | YES      | —         |
| last_scraped_at | timestamptz | YES      | —         |

### `project_subscriptions`

| Column              | Type        | Nullable | Default         |
| ------------------- | ----------- | -------- | --------------- |
| id                  | uuid        | NO       | PK              |
| user_id             | uuid        | NO       | —               |
| status              | text        | NO       | 'pending'       |
| payment_screenshots | jsonb       | YES      | '[]'            |
| admin_notes         | text        | YES      | —               |
| reviewed_by         | uuid        | YES      | —               |
| reviewed_at         | timestamptz | YES      | —               |
| created_at          | timestamptz | YES      | —               |
| updated_at          | timestamptz | YES      | —               |
| payment_method      | text        | YES      | 'bank_transfer' |
| keepz_payment_url   | text        | YES      | —               |

### `projects`

| Column              | Type        | Nullable | Default |
| ------------------- | ----------- | -------- | ------- |
| id                  | uuid        | NO       | PK      |
| course_id           | uuid        | NO       | —       |
| title               | text        | NO       | —       |
| title_ge            | text        | YES      | —       |
| description         | text        | YES      | —       |
| description_ge      | text        | YES      | —       |
| youtube_url         | text        | YES      | —       |
| status              | text        | NO       | 'draft' |
| position            | integer     | NO       | 0       |
| created_at          | timestamptz | YES      | —       |
| updated_at          | timestamptz | YES      | —       |
| deadline            | timestamptz | YES      | —       |
| submission_deadline | timestamptz | YES      | —       |
| max_submissions     | integer     | YES      | —       |
| allow_resubmission  | boolean     | YES      | false   |
| price               | numeric     | YES      | 0       |

### `referrals`

| Column                | Type        | Nullable | Default   |
| --------------------- | ----------- | -------- | --------- |
| id                    | uuid        | NO       | PK        |
| referrer_id           | uuid        | NO       | —         |
| referred_user_id      | uuid        | NO       | —         |
| enrollment_request_id | uuid        | YES      | —         |
| status                | text        | NO       | 'pending' |
| commission_amount     | numeric     | YES      | —         |
| created_at            | timestamptz | YES      | —         |

### `services`

| Column         | Type        | Nullable | Default |
| -------------- | ----------- | -------- | ------- |
| id             | uuid        | NO       | PK      |
| name           | varchar     | NO       | —       |
| description_en | text        | YES      | —       |
| description_ka | text        | YES      | —       |
| description_ru | text        | YES      | —       |
| photos         | ARRAY       | YES      | —       |
| created_at     | timestamptz | YES      | —       |
| updated_at     | timestamptz | YES      | —       |
| is_active      | boolean     | YES      | true    |

### `submission_reviews`

| Column         | Type        | Nullable | Default |
| -------------- | ----------- | -------- | ------- |
| id             | uuid        | NO       | PK      |
| submission_id  | uuid        | NO       | —       |
| criteria_id    | uuid        | NO       | —       |
| score          | integer     | NO       | —       |
| comment        | text        | YES      | —       |
| comment_ge     | text        | YES      | —       |
| reviewer_id    | uuid        | NO       | —       |
| created_at     | timestamptz | YES      | —       |
| updated_at     | timestamptz | YES      | —       |
| max_score      | integer     | NO       | —       |
| criteria_title | text        | YES      | —       |

### `typing_indicators`

| Column     | Type        | Nullable | Default |
| ---------- | ----------- | -------- | ------- |
| id         | uuid        | NO       | PK      |
| channel_id | uuid        | NO       | —       |
| user_id    | uuid        | NO       | —       |
| started_at | timestamptz | YES      | —       |
| expires_at | timestamptz | YES      | —       |

### `unread_messages`

| Column               | Type        | Nullable | Default |
| -------------------- | ----------- | -------- | ------- |
| id                   | uuid        | NO       | PK      |
| channel_id           | uuid        | NO       | —       |
| user_id              | uuid        | NO       | —       |
| unread_count         | integer     | YES      | 0       |
| last_read_message_id | uuid        | YES      | —       |
| created_at           | timestamptz | YES      | —       |
| updated_at           | timestamptz | YES      | —       |

### `video_progress`

| Column              | Type             | Nullable | Default |
| ------------------- | ---------------- | -------- | ------- |
| id                  | uuid             | NO       | PK      |
| user_id             | uuid             | NO       | —       |
| video_id            | uuid             | NO       | —       |
| current_time        | double precision | YES      | 0       |
| duration            | double precision | YES      | 0       |
| completed           | boolean          | YES      | false   |
| last_watched_at     | timestamptz      | YES      | —       |
| created_at          | timestamptz      | YES      | —       |
| updated_at          | timestamptz      | YES      | —       |
| progress_percentage | double precision | YES      | 0       |

### `videos`

| Column         | Type        | Nullable | Default |
| -------------- | ----------- | -------- | ------- |
| id             | uuid        | NO       | PK      |
| course_id      | uuid        | NO       | —       |
| title          | varchar     | NO       | —       |
| description    | text        | YES      | —       |
| video_url      | text        | YES      | —       |
| thumbnail_url  | text        | YES      | —       |
| duration       | integer     | YES      | 0       |
| position       | integer     | YES      | 0       |
| created_at     | timestamptz | YES      | —       |
| updated_at     | timestamptz | YES      | —       |
| title_ge       | varchar     | YES      | —       |
| description_ge | text        | YES      | —       |

### `view_scrape_results`

| Column         | Type        | Nullable | Default   |
| -------------- | ----------- | -------- | --------- |
| id             | uuid        | NO       | PK        |
| run_id         | uuid        | NO       | —         |
| submission_id  | uuid        | NO       | —         |
| youtube_url    | text        | NO       | —         |
| views_count    | integer     | YES      | —         |
| previous_views | integer     | YES      | —         |
| views_change   | integer     | YES      | —         |
| channel_name   | text        | YES      | —         |
| video_title    | text        | YES      | —         |
| published_at   | timestamptz | YES      | —         |
| error_message  | text        | YES      | —         |
| status         | text        | NO       | 'pending' |
| created_at     | timestamptz | YES      | —         |
| updated_at     | timestamptz | YES      | —         |

### `view_scrape_runs`

| Column            | Type        | Nullable | Default   |
| ----------------- | ----------- | -------- | --------- |
| id                | uuid        | NO       | PK        |
| status            | text        | NO       | 'pending' |
| total_submissions | integer     | YES      | 0         |
| processed_count   | integer     | YES      | 0         |
| success_count     | integer     | YES      | 0         |
| error_count       | integer     | YES      | 0         |
| started_at        | timestamptz | YES      | —         |
| completed_at      | timestamptz | YES      | —         |
| created_at        | timestamptz | YES      | —         |
| updated_at        | timestamptz | YES      | —         |

### `withdrawal_requests`

| Column              | Type        | Nullable | Default   |
| ------------------- | ----------- | -------- | --------- |
| id                  | uuid        | NO       | PK        |
| user_id             | uuid        | NO       | —         |
| user_type           | text        | NO       | —         |
| amount              | numeric     | NO       | —         |
| bank_account_number | text        | NO       | —         |
| status              | text        | NO       | 'pending' |
| admin_notes         | text        | YES      | —         |
| processed_at        | timestamptz | YES      | —         |
| processed_by        | uuid        | YES      | —         |
| created_at          | timestamptz | YES      | —         |
| updated_at          | timestamptz | YES      | —         |

---

## 5. RLS Policies

**142 policies** across **33 tables**.

### `balance_transactions` (2 policies)

| Policy                                   | Command | Condition                                                                 |
| ---------------------------------------- | ------- | ------------------------------------------------------------------------- |
| Admins can view all balance transactions | SELECT  | `EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')` |
| Users can view own balance transactions  | SELECT  | `auth.uid() = user_id`                                                    |

### `bundle_enrollment_requests` (4 policies)

| Policy                                          | Command | Condition                |
| ----------------------------------------------- | ------- | ------------------------ |
| Admins can update bundle enrollment requests    | UPDATE  | admin check via profiles |
| Admins can view all bundle enrollment requests  | SELECT  | admin check via profiles |
| Users can insert own bundle enrollment requests | INSERT  | `auth.uid() = user_id`   |
| Users can view own bundle enrollment requests   | SELECT  | `auth.uid() = user_id`   |

### `bundle_enrollments` (2 policies)

| Policy                                 | Command | Condition              |
| -------------------------------------- | ------- | ---------------------- |
| Admins can view all bundle enrollments | SELECT  | admin check            |
| Users can view own bundle enrollments  | SELECT  | `auth.uid() = user_id` |

### `channels` (8 policies)

| Policy                                        | Command | Condition                       |
| --------------------------------------------- | ------- | ------------------------------- |
| Admins can delete channels                    | DELETE  | admin check                     |
| Admins can insert channels                    | INSERT  | admin check                     |
| Admins can update channels                    | UPDATE  | admin check                     |
| Authenticated users can view channels         | SELECT  | `auth.role() = 'authenticated'` |
| Lecturers can delete own course channels      | DELETE  | lecturer enrolled in course     |
| Lecturers can insert channels for own courses | INSERT  | lecturer enrolled in course     |
| Lecturers can update own course channels      | UPDATE  | lecturer enrolled in course     |
| admin_manage_channels                         | ALL     | admin check                     |

### `coming_soon_emails` (2 policies)

| Policy                             | Command | Condition               |
| ---------------------------------- | ------- | ----------------------- |
| Admins can view coming_soon_emails | SELECT  | admin check             |
| Anyone can insert email            | INSERT  | `true` (no restriction) |

### `course_bundle_items` (3 policies)

| Policy                         | Command | Condition   |
| ------------------------------ | ------- | ----------- |
| Admins can insert bundle items | INSERT  | admin check |
| Admins can update bundle items | UPDATE  | admin check |
| Anyone can view bundle items   | SELECT  | `true`      |

### `course_bundles` (5 policies)

| Policy                         | Command | Condition          |
| ------------------------------ | ------- | ------------------ |
| Admins can delete bundles      | DELETE  | admin check        |
| Admins can insert bundles      | INSERT  | admin check        |
| Admins can update bundles      | UPDATE  | admin check        |
| Admins can view all bundles    | SELECT  | admin check        |
| Anyone can view active bundles | SELECT  | `is_active = true` |

### `courses` (4 policies)

| Policy                              | Command | Condition                  |
| ----------------------------------- | ------- | -------------------------- |
| Admins can do anything with courses | ALL     | admin check                |
| Anyone can view published courses   | SELECT  | `status = 'published'`     |
| Lecturers can manage own courses    | ALL     | `auth.uid() = lecturer_id` |
| admin_full_access                   | ALL     | admin check                |

### `dm_conversations` (2 policies)

| Policy                             | Command | Condition                                        |
| ---------------------------------- | ------- | ------------------------------------------------ |
| Users can insert own conversations | INSERT  | `auth.uid() = user1_id OR auth.uid() = user2_id` |
| Users can view own conversations   | SELECT  | `auth.uid() = user1_id OR auth.uid() = user2_id` |

### `dm_messages` (4 policies)

| Policy                           | Command | Condition                                  |
| -------------------------------- | ------- | ------------------------------------------ |
| Users can delete own dm messages | UPDATE  | `auth.uid() = sender_id` (is_deleted only) |
| Users can insert dm messages     | INSERT  | sender in conversation                     |
| Users can update own dm messages | UPDATE  | `auth.uid() = sender_id`                   |
| Users can view dm messages       | SELECT  | user in conversation                       |

### `enrollment_requests` (4 policies)

| Policy                                   | Command | Condition              |
| ---------------------------------------- | ------- | ---------------------- |
| Admins can update enrollment requests    | UPDATE  | admin check            |
| Admins can view all enrollment requests  | SELECT  | admin check            |
| Users can insert own enrollment requests | INSERT  | `auth.uid() = user_id` |
| Users can view own enrollment requests   | SELECT  | `auth.uid() = user_id` |

### `enrollments` (4 policies)

| Policy                          | Command | Condition              |
| ------------------------------- | ------- | ---------------------- |
| Admins can delete enrollments   | DELETE  | admin check            |
| Admins can insert enrollments   | INSERT  | admin check            |
| Admins can view all enrollments | SELECT  | admin check            |
| Users can view own enrollments  | SELECT  | `auth.uid() = user_id` |

### `friend_requests` (4 policies)

| Policy                             | Command | Condition                                            |
| ---------------------------------- | ------- | ---------------------------------------------------- |
| Users can delete own requests      | DELETE  | `auth.uid() = sender_id`                             |
| Users can insert friend requests   | INSERT  | `auth.uid() = sender_id`                             |
| Users can update received requests | UPDATE  | `auth.uid() = receiver_id`                           |
| Users can view own requests        | SELECT  | `auth.uid() = sender_id OR auth.uid() = receiver_id` |

### `friendships` (2 policies)

| Policy                           | Command | Condition                                        |
| -------------------------------- | ------- | ------------------------------------------------ |
| Users can delete own friendships | DELETE  | `auth.uid() = user_id`                           |
| Users can view own friendships   | SELECT  | `auth.uid() = user_id OR auth.uid() = friend_id` |

### `message_attachments` (6 policies)

| Policy                                      | Command | Condition                         |
| ------------------------------------------- | ------- | --------------------------------- |
| Admins can delete any attachment            | DELETE  | admin check                       |
| Admins can view all attachments             | SELECT  | admin check                       |
| Enrolled users can insert attachments       | INSERT  | user enrolled in channel's course |
| Enrolled users can view channel attachments | SELECT  | user enrolled in channel's course |
| Users can delete own attachments            | DELETE  | `auth.uid() = user_id`            |
| Users can insert dm attachments             | INSERT  | user in DM conversation           |

### `messages` (10 policies)

| Policy                                       | Command | Condition                           |
| -------------------------------------------- | ------- | ----------------------------------- |
| Admins can delete any message                | DELETE  | admin check                         |
| Admins can insert messages                   | INSERT  | admin check                         |
| Admins can view all messages                 | SELECT  | admin check                         |
| Enrolled users can insert messages           | INSERT  | enrolled in channel's course        |
| Enrolled users can view messages             | SELECT  | enrolled in channel's course        |
| Lecturers can delete messages in own courses | DELETE  | lecturer of course                  |
| Users can delete own messages                | UPDATE  | `auth.uid() = user_id` (is_deleted) |
| Users can update own messages                | UPDATE  | `auth.uid() = user_id`              |
| admin_manage_messages                        | ALL     | admin check                         |
| lecturer_manage_messages                     | ALL     | lecturer of course                  |

### `muted_users` (4 policies)

| Policy                                | Command | Condition                                            |
| ------------------------------------- | ------- | ---------------------------------------------------- |
| Users can delete own mutes            | DELETE  | `auth.uid() = user_id`                               |
| Users can insert own mutes            | INSERT  | `auth.uid() = user_id`                               |
| Users can view mutes relevant to them | SELECT  | `auth.uid() = user_id OR auth.uid() = muted_user_id` |
| Users can view own mutes              | SELECT  | `auth.uid() = user_id`                               |

### `notifications` (5 policies)

| Policy                             | Command | Condition              |
| ---------------------------------- | ------- | ---------------------- |
| Admins can insert notifications    | INSERT  | admin check            |
| Admins can view all notifications  | SELECT  | admin check            |
| System can insert notifications    | INSERT  | service_role check     |
| Users can update own notifications | UPDATE  | `auth.uid() = user_id` |
| Users can view own notifications   | SELECT  | `auth.uid() = user_id` |

### `profiles` (6 policies)

| Policy                                | Command | Condition                       |
| ------------------------------------- | ------- | ------------------------------- |
| Admins can do anything with profiles  | ALL     | admin check                     |
| Admins can update any profile         | UPDATE  | admin check                     |
| Authenticated users can view profiles | SELECT  | `auth.role() = 'authenticated'` |
| Service role full access              | ALL     | `true` (service role)           |
| Users can insert own profile          | INSERT  | `auth.uid() = id`               |
| Users can update own profile          | UPDATE  | `auth.uid() = id`               |

### `project_criteria` (6 policies)

| Policy                                | Command | Condition                       |
| ------------------------------------- | ------- | ------------------------------- |
| Admins can delete criteria            | DELETE  | admin check                     |
| Admins can insert criteria            | INSERT  | admin check                     |
| Admins can update criteria            | UPDATE  | admin check                     |
| Authenticated users can view criteria | SELECT  | `auth.role() = 'authenticated'` |
| Lecturers can insert criteria         | INSERT  | lecturer of course              |
| Lecturers can update criteria         | UPDATE  | lecturer of course              |

### `project_submissions` (8 policies)

| Policy                                | Command | Condition              |
| ------------------------------------- | ------- | ---------------------- |
| Admins can update submissions         | UPDATE  | admin check            |
| Admins can view all submissions       | SELECT  | admin check            |
| Lecturers can update submissions      | UPDATE  | lecturer of course     |
| Lecturers can view course submissions | SELECT  | lecturer of course     |
| Service role can update submissions   | UPDATE  | `true` (service role)  |
| Users can insert own submissions      | INSERT  | `auth.uid() = user_id` |
| Users can update own submissions      | UPDATE  | `auth.uid() = user_id` |
| Users can view own submissions        | SELECT  | `auth.uid() = user_id` |

### `project_subscriptions` (3 policies)

| Policy                              | Command | Condition              |
| ----------------------------------- | ------- | ---------------------- |
| Admins can manage all subscriptions | ALL     | admin check            |
| Users can insert own subscriptions  | INSERT  | `auth.uid() = user_id` |
| Users can view own subscriptions    | SELECT  | `auth.uid() = user_id` |

### `projects` (6 policies)

| Policy                                          | Command | Condition              |
| ----------------------------------------------- | ------- | ---------------------- |
| Admins can do anything with projects            | ALL     | admin check            |
| Authenticated users can view published projects | SELECT  | `status = 'published'` |
| Lecturers can insert projects                   | INSERT  | lecturer of course     |
| Lecturers can update own course projects        | UPDATE  | lecturer of course     |
| Lecturers can view own course projects          | SELECT  | lecturer of course     |
| admin_full_projects_access                      | ALL     | admin check            |

### `referrals` (3 policies)

| Policy                                   | Command | Condition                       |
| ---------------------------------------- | ------- | ------------------------------- |
| Admins can view all referrals            | SELECT  | admin check                     |
| Users can view own referrals as referred | SELECT  | `auth.uid() = referred_user_id` |
| Users can view own referrals as referrer | SELECT  | `auth.uid() = referrer_id`      |

### `services` (2 policies)

| Policy                          | Command | Condition          |
| ------------------------------- | ------- | ------------------ |
| Admins can manage services      | ALL     | admin check        |
| Public can view active services | SELECT  | `is_active = true` |

### `submission_reviews` (4 policies)

| Policy                                    | Command | Condition                       |
| ----------------------------------------- | ------- | ------------------------------- |
| Admins can manage reviews                 | ALL     | admin check                     |
| Lecturers can insert reviews              | INSERT  | lecturer of submission's course |
| Lecturers can update own reviews          | UPDATE  | `auth.uid() = reviewer_id`      |
| Users can view reviews of own submissions | SELECT  | user owns submission            |

### `typing_indicators` (6 policies)

| Policy                                     | Command | Condition                    |
| ------------------------------------------ | ------- | ---------------------------- |
| Enrolled users can delete own indicators   | DELETE  | `auth.uid() = user_id`       |
| Enrolled users can insert indicators       | INSERT  | enrolled in channel's course |
| Enrolled users can update own indicators   | UPDATE  | `auth.uid() = user_id`       |
| Enrolled users can view indicators         | SELECT  | enrolled in channel's course |
| Service role can delete expired indicators | DELETE  | `true` (service role)        |
| admin_manage_typing_indicators             | ALL     | admin check                  |

### `unread_messages` (3 policies)

| Policy                              | Command | Condition              |
| ----------------------------------- | ------- | ---------------------- |
| Users can insert own unread records | INSERT  | `auth.uid() = user_id` |
| Users can update own unread records | UPDATE  | `auth.uid() = user_id` |
| Users can view own unread records   | SELECT  | `auth.uid() = user_id` |

### `video_progress` (3 policies)

| Policy                        | Command | Condition              |
| ----------------------------- | ------- | ---------------------- |
| Users can insert own progress | INSERT  | `auth.uid() = user_id` |
| Users can update own progress | UPDATE  | `auth.uid() = user_id` |
| Users can view own progress   | SELECT  | `auth.uid() = user_id` |

### `videos` (6 policies)

| Policy                                 | Command | Condition          |
| -------------------------------------- | ------- | ------------------ |
| Admins can do anything with videos     | ALL     | admin check        |
| Enrolled users can view course videos  | SELECT  | enrolled in course |
| Lecturers can insert videos            | INSERT  | lecturer of course |
| Lecturers can update own course videos | UPDATE  | lecturer of course |
| Lecturers can view own course videos   | SELECT  | lecturer of course |
| admin_full_videos_access               | ALL     | admin check        |

### `view_scrape_results` (4 policies)

| Policy                                   | Command | Condition                           |
| ---------------------------------------- | ------- | ----------------------------------- |
| Admins can manage scrape results         | ALL     | admin check                         |
| Lecturers can view course scrape results | SELECT  | lecturer of course (via submission) |
| Service role full access results         | ALL     | `true` (service role)               |
| Users can view own scrape results        | SELECT  | user owns submission                |

### `view_scrape_runs` (3 policies)

| Policy                                   | Command | Condition                       |
| ---------------------------------------- | ------- | ------------------------------- |
| Admins can manage scrape runs            | ALL     | admin check                     |
| Authenticated users can view scrape runs | SELECT  | `auth.role() = 'authenticated'` |
| Service role full access runs            | ALL     | `true` (service role)           |

### `withdrawal_requests` (4 policies)

| Policy                                   | Command | Condition              |
| ---------------------------------------- | ------- | ---------------------- |
| Admins can update withdrawal requests    | UPDATE  | admin check            |
| Admins can view all withdrawal requests  | SELECT  | admin check            |
| Users can insert own withdrawal requests | INSERT  | `auth.uid() = user_id` |
| Users can view own withdrawal requests   | SELECT  | `auth.uid() = user_id` |

---

## 6. Database Functions / RPCs

**49 functions** (42 SECURITY DEFINER, 7 SECURITY INVOKER).

| Function                              | Arguments                                                                                                                                                             | Returns                                                                                | Security |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------- |
| approve_bundle_enrollment_request     | request_id uuid                                                                                                                                                       | void                                                                                   | DEFINER  |
| approve_bundle_enrollment_request     | request_id uuid, admin_user_id uuid DEFAULT NULL                                                                                                                      | void                                                                                   | DEFINER  |
| approve_enrollment_request            | request_id uuid                                                                                                                                                       | void                                                                                   | DEFINER  |
| approve_project_subscription          | subscription_id uuid                                                                                                                                                  | jsonb                                                                                  | DEFINER  |
| approve_withdrawal_request            | p_request_id uuid, p_admin_notes text DEFAULT NULL                                                                                                                    | void                                                                                   | DEFINER  |
| auto_generate_referral_code           | (none)                                                                                                                                                                | trigger                                                                                | INVOKER  |
| check_is_admin                        | user_id uuid                                                                                                                                                          | boolean                                                                                | DEFINER  |
| check_username_unique                 | (none)                                                                                                                                                                | trigger                                                                                | INVOKER  |
| cleanup_expired_typing_indicators     | (none)                                                                                                                                                                | void                                                                                   | DEFINER  |
| cleanup_friend_request_on_unfriend    | (none)                                                                                                                                                                | trigger                                                                                | DEFINER  |
| create_default_channels_for_course    | (none)                                                                                                                                                                | trigger                                                                                | DEFINER  |
| create_friendship_on_accept           | (none)                                                                                                                                                                | trigger                                                                                | DEFINER  |
| create_notification                   | p_user_id uuid, p_type text, p_title_en text, p_title_ge text, p_message_en text, p_message_ge text, p_metadata jsonb DEFAULT '{}', p_created_by uuid DEFAULT NULL    | uuid                                                                                   | DEFINER  |
| create_withdrawal_request             | p_amount numeric, p_bank_account_number text                                                                                                                          | uuid                                                                                   | DEFINER  |
| credit_user_balance                   | p_user_id uuid, p_amount numeric, p_source text, p_reference_id uuid DEFAULT NULL, p_reference_type text DEFAULT NULL, p_description text DEFAULT NULL                | uuid                                                                                   | DEFINER  |
| debit_user_balance                    | p_user_id uuid, p_amount numeric, p_source text, p_reference_id uuid DEFAULT NULL, p_reference_type text DEFAULT NULL, p_description text DEFAULT NULL                | uuid                                                                                   | DEFINER  |
| delete_friendship_on_reject           | (none)                                                                                                                                                                | trigger                                                                                | DEFINER  |
| generate_referral_code                | (none)                                                                                                                                                                | text                                                                                   | INVOKER  |
| get_bundle_enrollment_requests_admin  | filter_status text DEFAULT NULL                                                                                                                                       | TABLE(...)                                                                             | DEFINER  |
| get_enrolled_user_ids                 | p_course_id uuid                                                                                                                                                      | uuid[]                                                                                 | DEFINER  |
| get_enrollment_requests_admin         | filter_status text DEFAULT NULL                                                                                                                                       | TABLE(...)                                                                             | DEFINER  |
| get_enrollment_requests_count         | (none)                                                                                                                                                                | TABLE(total_count, pending_count, approved_count, rejected_count)                      | DEFINER  |
| get_profiles_for_friends              | user_ids uuid[]                                                                                                                                                       | TABLE(id, username, email, avatar_url)                                                 | DEFINER  |
| get_unread_notification_count         | p_user_id uuid                                                                                                                                                        | integer                                                                                | DEFINER  |
| get_user_balance_info                 | p_user_id uuid                                                                                                                                                        | TABLE(balance, bank_account_number, pending_withdrawal, total_earned, total_withdrawn) | DEFINER  |
| get_user_ids_by_role                  | p_role text                                                                                                                                                           | uuid[]                                                                                 | DEFINER  |
| get_view_scraper_schedule             | (none)                                                                                                                                                                | jsonb                                                                                  | DEFINER  |
| get_withdrawal_requests_admin         | filter_status text DEFAULT NULL                                                                                                                                       | TABLE(...)                                                                             | DEFINER  |
| handle_new_user                       | (none)                                                                                                                                                                | trigger                                                                                | DEFINER  |
| handle_updated_at                     | (none)                                                                                                                                                                | trigger                                                                                | INVOKER  |
| has_project_access                    | uid uuid                                                                                                                                                              | boolean                                                                                | DEFINER  |
| mark_all_notifications_read           | p_user_id uuid                                                                                                                                                        | integer                                                                                | DEFINER  |
| prevent_reverse_friend_request        | (none)                                                                                                                                                                | trigger                                                                                | INVOKER  |
| process_referral                      | p_referral_code text, p_referred_user_id uuid, p_enrollment_request_id uuid, p_course_id uuid                                                                         | uuid                                                                                   | DEFINER  |
| process_signup_referral_on_enrollment | p_user_id uuid, p_enrollment_request_id uuid, p_course_id uuid                                                                                                        | uuid                                                                                   | DEFINER  |
| reject_bundle_enrollment_request      | request_id uuid, admin_user_id uuid DEFAULT NULL                                                                                                                      | void                                                                                   | DEFINER  |
| reject_enrollment_request             | request_id uuid                                                                                                                                                       | void                                                                                   | DEFINER  |
| reject_project_subscription           | subscription_id uuid                                                                                                                                                  | void                                                                                   | DEFINER  |
| reject_withdrawal_request             | p_request_id uuid, p_admin_notes text DEFAULT NULL                                                                                                                    | void                                                                                   | DEFINER  |
| reset_unread_count                    | p_channel_id uuid, p_user_id uuid                                                                                                                                     | void                                                                                   | DEFINER  |
| restrict_dm_message_update            | (none)                                                                                                                                                                | trigger                                                                                | INVOKER  |
| restrict_friend_request_update        | (none)                                                                                                                                                                | trigger                                                                                | INVOKER  |
| search_users                          | search_query text, exclude_user_id uuid, result_limit integer DEFAULT 10                                                                                              | TABLE(id, username, email, avatar_url)                                                 | DEFINER  |
| search_users_by_email                 | search_query text, exclude_user_id uuid, result_limit integer DEFAULT 10                                                                                              | TABLE(id, username, email, avatar_url)                                                 | DEFINER  |
| send_bulk_notifications               | p_user_ids uuid[], p_type text, p_title_en text, p_title_ge text, p_message_en text, p_message_ge text, p_metadata jsonb DEFAULT '{}', p_created_by uuid DEFAULT NULL | integer                                                                                | DEFINER  |
| update_dm_conversation_last_message   | (none)                                                                                                                                                                | trigger                                                                                | DEFINER  |
| update_own_profile                    | new_username text DEFAULT NULL, new_avatar_url text DEFAULT NULL                                                                                                      | jsonb                                                                                  | DEFINER  |
| update_unread_counts                  | (none)                                                                                                                                                                | trigger                                                                                | DEFINER  |
| update_view_scraper_schedule          | p_schedule text DEFAULT NULL, p_active boolean DEFAULT NULL                                                                                                           | jsonb                                                                                  | DEFINER  |

---

## 7. Triggers

**26 triggers** across 16 tables.

| Trigger                              | Event  | Table                      | Function                              | Timing |
| ------------------------------------ | ------ | -------------------------- | ------------------------------------- | ------ |
| on_bundle_enrollment_request_updated | UPDATE | bundle_enrollment_requests | handle_updated_at()                   | BEFORE |
| on_course_bundle_updated             | UPDATE | course_bundles             | handle_updated_at()                   | BEFORE |
| on_course_created_create_channels    | INSERT | courses                    | create_default_channels_for_course()  | AFTER  |
| on_course_updated                    | UPDATE | courses                    | handle_updated_at()                   | BEFORE |
| on_dm_message_sent                   | INSERT | dm_messages                | update_dm_conversation_last_message() | AFTER  |
| restrict_dm_message_update           | UPDATE | dm_messages                | restrict_dm_message_update()          | BEFORE |
| on_enrollment_request_updated        | UPDATE | enrollment_requests        | handle_updated_at()                   | BEFORE |
| create_friendship_on_accept          | UPDATE | friend_requests            | create_friendship_on_accept()         | AFTER  |
| delete_friendship_on_reject          | UPDATE | friend_requests            | delete_friendship_on_reject()         | AFTER  |
| on_friend_requests_updated           | UPDATE | friend_requests            | handle_updated_at()                   | BEFORE |
| prevent_reverse_friend_request       | INSERT | friend_requests            | prevent_reverse_friend_request()      | BEFORE |
| restrict_friend_request_update       | UPDATE | friend_requests            | restrict_friend_request_update()      | BEFORE |
| cleanup_friend_request_on_unfriend   | DELETE | friendships                | cleanup_friend_request_on_unfriend()  | AFTER  |
| on_message_insert_update_unread      | INSERT | messages                   | update_unread_counts()                | AFTER  |
| on_message_updated                   | UPDATE | messages                   | handle_updated_at()                   | BEFORE |
| on_notification_updated              | UPDATE | notifications              | handle_updated_at()                   | BEFORE |
| auto_generate_referral_code_trigger  | INSERT | profiles                   | auto_generate_referral_code()         | BEFORE |
| auto_generate_referral_code_trigger  | UPDATE | profiles                   | auto_generate_referral_code()         | BEFORE |
| enforce_username_unique              | INSERT | profiles                   | check_username_unique()               | BEFORE |
| enforce_username_unique              | UPDATE | profiles                   | check_username_unique()               | BEFORE |
| on_profile_updated                   | UPDATE | profiles                   | handle_updated_at()                   | BEFORE |
| on_project_submission_updated        | UPDATE | project_submissions        | handle_updated_at()                   | BEFORE |
| on_project_updated                   | UPDATE | projects                   | handle_updated_at()                   | BEFORE |
| update_services_updated_at           | UPDATE | services                   | handle_updated_at()                   | BEFORE |
| on_submission_review_updated         | UPDATE | submission_reviews         | handle_updated_at()                   | BEFORE |
| on_withdrawal_request_updated        | UPDATE | withdrawal_requests        | handle_updated_at()                   | BEFORE |

---

## 8. Indexes

**155 indexes** across 28 tables. Listed by table.

### balance_transactions (7)

- `balance_transactions_pkey` — UNIQUE btree (id)
- `balance_transactions_created_at_idx` — btree (created_at DESC)
- `balance_transactions_reference_idx` — btree (reference_id, reference_type)
- `balance_transactions_source_idx` — btree (source)
- `balance_transactions_user_created_idx` — btree (user_id, created_at DESC)
- `balance_transactions_user_id_idx` — btree (user_id)
- `balance_transactions_user_type_idx` — btree (user_id, transaction_type, created_at DESC)

### bundle_enrollment_requests (6)

- `bundle_enrollment_requests_pkey` — UNIQUE btree (id)
- `bundle_enrollment_requests_bundle_id_idx` — btree (bundle_id)
- `bundle_enrollment_requests_created_at_idx` — btree (created_at DESC)
- `bundle_enrollment_requests_status_idx` — btree (status)
- `bundle_enrollment_requests_user_bundle_pending_idx` — UNIQUE btree (user_id, bundle_id) WHERE status = 'pending'
- `bundle_enrollment_requests_user_id_idx` — btree (user_id)

### bundle_enrollments (4)

- `bundle_enrollments_pkey` — UNIQUE btree (id)
- `bundle_enrollments_bundle_id_idx` — btree (bundle_id)
- `bundle_enrollments_user_id_bundle_id_key` — UNIQUE btree (user_id, bundle_id)
- `bundle_enrollments_user_id_idx` — btree (user_id)

### channels (5)

- `channels_pkey` — UNIQUE btree (id)
- `channels_course_id_idx` — btree (course_id)
- `channels_course_id_name_key` — UNIQUE btree (course_id, name)
- `channels_display_order_idx` — btree (course_id, display_order)
- `channels_type_idx` — btree (type)

### coming_soon_emails (4)

- `coming_soon_emails_pkey` — UNIQUE btree (id)
- `coming_soon_emails_email_key` — UNIQUE btree (email)
- `idx_coming_soon_emails_created_at` — btree (created_at DESC)
- `idx_coming_soon_emails_email` — btree (email)

### course_bundle_items (4)

- `course_bundle_items_pkey` — UNIQUE btree (id)
- `course_bundle_items_bundle_id_course_id_key` — UNIQUE btree (bundle_id, course_id)
- `course_bundle_items_bundle_id_idx` — btree (bundle_id)
- `course_bundle_items_course_id_idx` — btree (course_id)

### course_bundles (4)

- `course_bundles_pkey` — UNIQUE btree (id)
- `course_bundles_created_at_idx` — btree (created_at DESC)
- `course_bundles_is_active_idx` — btree (is_active)
- `course_bundles_lecturer_id_idx` — btree (lecturer_id)

### courses (7)

- `courses_pkey` — UNIQUE btree (id)
- `courses_bestseller_idx` — btree (is_bestseller) WHERE is_bestseller = true
- `courses_created_at_idx` — btree (created_at DESC)
- `courses_lecturer_id_idx` — btree (lecturer_id)
- `courses_rating_idx` — btree (rating DESC)
- `courses_referral_commission_idx` — btree (referral_commission_percentage) WHERE > 0
- `courses_type_idx` — btree (course_type)

### dm_conversations (5)

- `dm_conversations_pkey` — UNIQUE btree (id)
- `dm_conversations_user1_id_user2_id_key` — UNIQUE btree (user1_id, user2_id)
- `idx_dm_conversations_last_msg` — btree (last_message_at DESC)
- `idx_dm_conversations_user1` — btree (user1_id)
- `idx_dm_conversations_user2` — btree (user2_id)

### dm_messages (4)

- `dm_messages_pkey` — UNIQUE btree (id)
- `idx_dm_messages_conversation_created` — btree (conversation_id, created_at DESC)
- `idx_dm_messages_reply_to` — btree (reply_to_id) WHERE reply_to_id IS NOT NULL
- `idx_dm_messages_user` — btree (user_id)

### enrollment_requests (9)

- `enrollment_requests_pkey` — UNIQUE btree (id)
- `enrollment_requests_course_id_idx` — btree (course_id)
- `enrollment_requests_created_at_idx` — btree (created_at DESC)
- `enrollment_requests_referral_code_idx` — btree (referral_code) WHERE referral_code IS NOT NULL
- `enrollment_requests_status_created_idx` — btree (status, created_at DESC) WHERE status = 'pending'
- `enrollment_requests_status_idx` — btree (status)
- `enrollment_requests_user_course_pending_idx` — UNIQUE btree (user_id, course_id) WHERE status = 'pending'
- `enrollment_requests_user_id_course_id_status_key` — UNIQUE btree (user_id, course_id, status)
- `enrollment_requests_user_id_idx` — btree (user_id)

### enrollments (6)

- `enrollments_pkey` — UNIQUE btree (id)
- `enrollments_course_idx` — btree (course_id)
- `enrollments_expires_at_idx` — btree (expires_at) WHERE expires_at IS NOT NULL
- `enrollments_user_course_expires_idx` — btree (user_id, course_id, expires_at)
- `enrollments_user_course_idx` — UNIQUE btree (user_id, course_id)
- `enrollments_user_idx` — btree (user_id)

### friend_requests (5)

- `friend_requests_pkey` — UNIQUE btree (id)
- `friend_requests_sender_id_receiver_id_key` — UNIQUE btree (sender_id, receiver_id)
- `idx_friend_requests_receiver` — btree (receiver_id)
- `idx_friend_requests_sender` — btree (sender_id)
- `idx_friend_requests_status` — btree (status)

### friendships (4)

- `friendships_pkey` — UNIQUE btree (id)
- `friendships_user1_id_user2_id_key` — UNIQUE btree (user1_id, user2_id)
- `idx_friendships_user1` — btree (user1_id)
- `idx_friendships_user2` — btree (user2_id)

### message_attachments (4)

- `message_attachments_pkey` — UNIQUE btree (id)
- `message_attachments_channel_id_idx` — btree (channel_id)
- `message_attachments_course_id_idx` — btree (course_id)
- `message_attachments_message_id_idx` — btree (message_id)

### messages (8)

- `messages_pkey` — UNIQUE btree (id)
- `messages_channel_created_idx` — btree (channel_id, created_at DESC)
- `messages_channel_id_idx` — btree (channel_id)
- `messages_course_created_at_idx` — btree (course_id, created_at DESC)
- `messages_course_id_idx` — btree (course_id)
- `messages_created_at_idx` — btree (channel_id, created_at DESC)
- `messages_reply_to_idx` — btree (reply_to_id)
- `messages_user_id_idx` — btree (user_id)

### muted_users (6)

- `muted_users_pkey` — UNIQUE btree (id)
- `muted_users_channel_id_idx` — btree (channel_id)
- `muted_users_course_id_idx` — btree (course_id)
- `muted_users_lecturer_id_idx` — btree (lecturer_id)
- `muted_users_lecturer_user_unique` — UNIQUE btree (lecturer_id, user_id)
- `muted_users_user_id_idx` — btree (user_id)

### notifications (7)

- `notifications_pkey` — UNIQUE btree (id)
- `notifications_created_at_idx` — btree (created_at DESC)
- `notifications_metadata_gin` — GIN (metadata)
- `notifications_read_idx` — btree (read)
- `notifications_type_idx` — btree (type)
- `notifications_user_id_idx` — btree (user_id)
- `notifications_user_read_idx` — btree (user_id, read)

### profiles (12)

- `profiles_pkey` — UNIQUE btree (id)
- `profiles_balance_idx` — btree (balance) WHERE balance > 0
- `profiles_bank_account_idx` — btree (bank_account_number) WHERE bank_account_number IS NOT NULL
- `profiles_email_idx` — btree (email)
- `profiles_email_key` — UNIQUE btree (email)
- `profiles_first_login_completed_idx` — btree (first_login_completed) WHERE first_login_completed = false
- `profiles_referral_code_idx` — btree (referral_code) WHERE referral_code IS NOT NULL
- `profiles_referral_code_key` — UNIQUE btree (referral_code)
- `profiles_referred_for_course_id_idx` — btree (referred_for_course_id) WHERE referred_for_course_id IS NOT NULL
- `profiles_role_idx` — btree (role)
- `profiles_signup_referral_code_idx` — btree (signup_referral_code) WHERE signup_referral_code IS NOT NULL
- `profiles_username_idx` — UNIQUE btree (username)

### project_criteria (4)

- `project_criteria_pkey` — UNIQUE btree (id)
- `project_criteria_display_order_idx` — btree (project_id, display_order)
- `project_criteria_platform_idx` — btree (project_id, platform)
- `project_criteria_project_id_idx` — btree (project_id)

### project_submissions (9)

- `project_submissions_pkey` — UNIQUE btree (id)
- `project_submissions_channel_id_idx` — btree (channel_id)
- `project_submissions_course_id_idx` — btree (course_id)
- `project_submissions_created_at_idx` — btree (created_at DESC)
- `project_submissions_message_id_idx` — btree (message_id)
- `project_submissions_message_id_key` — UNIQUE btree (message_id)
- `project_submissions_project_created_idx` — btree (project_id, created_at DESC)
- `project_submissions_project_id_idx` — btree (project_id)
- `project_submissions_user_id_idx` — btree (user_id)

### project_subscriptions (4)

- `project_subscriptions_pkey` — UNIQUE btree (id)
- `idx_project_subscriptions_created_at` — btree (created_at DESC)
- `idx_project_subscriptions_status` — btree (status)
- `idx_project_subscriptions_user_id` — btree (user_id)

### projects (9)

- `projects_pkey` — UNIQUE btree (id)
- `projects_channel_id_idx` — btree (channel_id)
- `projects_course_id_idx` — btree (course_id)
- `projects_created_at_idx` — btree (created_at DESC)
- `projects_end_date_idx` — btree (end_date)
- `projects_message_id_idx` — btree (message_id)
- `projects_message_id_key` — UNIQUE btree (message_id)
- `projects_start_date_idx` — btree (start_date)
- `projects_user_id_idx` — btree (user_id)

### referrals (10)

- `referrals_pkey` — UNIQUE btree (id)
- `referrals_course_id_idx` — btree (course_id)
- `referrals_created_at_idx` — btree (created_at DESC)
- `referrals_enrollment_request_id_idx` — btree (enrollment_request_id)
- `referrals_enrollment_request_idx` — btree (enrollment_request_id) WHERE enrollment_request_id IS NOT NULL
- `referrals_referral_code_idx` — btree (referral_code)
- `referrals_referred_user_id_enrollment_request_id_key` — UNIQUE btree (referred_user_id, enrollment_request_id)
- `referrals_referred_user_id_idx` — btree (referred_user_id)
- `referrals_referrer_created_idx` — btree (referrer_id, created_at DESC)
- `referrals_referrer_id_idx` — btree (referrer_id)

### services (2)

- `services_pkey` — UNIQUE btree (id)
- `idx_services_is_active` — btree (is_active)

### submission_reviews (6)

- `submission_reviews_pkey` — UNIQUE btree (id)
- `submission_reviews_lecturer_id_idx` — btree (lecturer_id)
- `submission_reviews_platform_idx` — btree (submission_id, platform)
- `submission_reviews_project_id_idx` — btree (project_id)
- `submission_reviews_status_idx` — btree (status)
- `submission_reviews_submission_id_idx` — btree (submission_id)

### typing_indicators (5)

- `typing_indicators_pkey` — UNIQUE btree (id)
- `typing_indicators_channel_id_idx` — btree (channel_id)
- `typing_indicators_channel_id_user_id_key` — UNIQUE btree (channel_id, user_id)
- `typing_indicators_expires_at_idx` — btree (expires_at)
- `typing_indicators_user_id_idx` — btree (user_id)

### unread_messages (6)

- `unread_messages_pkey` — UNIQUE btree (id)
- `unread_messages_channel_id_idx` — btree (channel_id)
- `unread_messages_channel_id_user_id_key` — UNIQUE btree (channel_id, user_id)
- `unread_messages_course_id_idx` — btree (course_id)
- `unread_messages_user_channel_idx` — btree (user_id, channel_id)
- `unread_messages_user_id_idx` — btree (user_id)

### video_progress (6)

- `video_progress_pkey` — UNIQUE btree (id)
- `video_progress_completed_idx` — btree (user_id, course_id, is_completed)
- `video_progress_course_id_idx` — btree (course_id)
- `video_progress_user_id_idx` — btree (user_id)
- `video_progress_user_id_video_id_key` — UNIQUE btree (user_id, video_id)
- `video_progress_video_id_idx` — btree (video_id)

### videos (4)

- `videos_pkey` — UNIQUE btree (id)
- `videos_channel_id_idx` — btree (channel_id)
- `videos_course_id_idx` — btree (course_id)
- `videos_display_order_idx` — btree (channel_id, display_order)

### view_scrape_results (4)

- `view_scrape_results_pkey` — UNIQUE btree (id)
- `idx_view_scrape_results_project` — btree (project_id, scraped_at DESC)
- `idx_view_scrape_results_run` — btree (scrape_run_id)
- `idx_view_scrape_results_submission` — btree (submission_id, platform, scraped_at DESC)

### view_scrape_runs (1)

- `view_scrape_runs_pkey` — UNIQUE btree (id)

### withdrawal_requests (6)

- `withdrawal_requests_pkey` — UNIQUE btree (id)
- `withdrawal_requests_created_at_idx` — btree (created_at DESC)
- `withdrawal_requests_status_idx` — btree (status)
- `withdrawal_requests_user_id_idx` — btree (user_id)
- `withdrawal_requests_user_pending_idx` — UNIQUE btree (user_id) WHERE status = 'pending'
- `withdrawal_requests_user_type_idx` — btree (user_type)

---

## 9. Foreign Key Constraints

**42 foreign keys** across the database.

| Table                      | Column                 | References             | Constraint                                |
| -------------------------- | ---------------------- | ---------------------- | ----------------------------------------- |
| bundle_enrollment_requests | bundle_id              | course_bundles.id      | bundle_enrollment_requests_bundle_id_fkey |
| bundle_enrollments         | bundle_id              | course_bundles.id      | bundle_enrollments_bundle_id_fkey         |
| channels                   | course_id              | courses.id             | channels_course_id_fkey                   |
| course_bundle_items        | bundle_id              | course_bundles.id      | course_bundle_items_bundle_id_fkey        |
| course_bundle_items        | course_id              | courses.id             | course_bundle_items_course_id_fkey        |
| course_bundles             | lecturer_id            | profiles.id            | course_bundles_lecturer_id_fkey           |
| courses                    | lecturer_id            | profiles.id            | courses_lecturer_id_fkey                  |
| dm_messages                | conversation_id        | dm_conversations.id    | dm_messages_conversation_id_fkey          |
| dm_messages                | reply_to_id            | dm_messages.id         | dm_messages_reply_to_id_fkey              |
| enrollment_requests        | course_id              | courses.id             | enrollment_requests_course_id_fkey        |
| enrollments                | course_id              | courses.id             | enrollments_course_id_fkey                |
| message_attachments        | channel_id             | channels.id            | message_attachments_channel_id_fkey       |
| message_attachments        | course_id              | courses.id             | message_attachments_course_id_fkey        |
| message_attachments        | message_id             | messages.id            | message_attachments_message_id_fkey       |
| messages                   | channel_id             | channels.id            | messages_channel_id_fkey                  |
| messages                   | course_id              | courses.id             | messages_course_id_fkey                   |
| messages                   | reply_to_id            | messages.id            | messages_reply_to_id_fkey                 |
| muted_users                | channel_id             | channels.id            | muted_users_channel_id_fkey               |
| muted_users                | course_id              | courses.id             | muted_users_course_id_fkey                |
| profiles                   | referred_for_course_id | courses.id             | profiles_referred_for_course_id_fkey      |
| project_criteria           | project_id             | projects.id            | project_criteria_project_id_fkey          |
| project_submissions        | channel_id             | channels.id            | project_submissions_channel_id_fkey       |
| project_submissions        | course_id              | courses.id             | project_submissions_course_id_fkey        |
| project_submissions        | message_id             | messages.id            | project_submissions_message_id_fkey       |
| project_submissions        | project_id             | projects.id            | project_submissions_project_id_fkey       |
| projects                   | channel_id             | channels.id            | projects_channel_id_fkey                  |
| projects                   | course_id              | courses.id             | projects_course_id_fkey                   |
| projects                   | message_id             | messages.id            | projects_message_id_fkey                  |
| referrals                  | course_id              | courses.id             | referrals_course_id_fkey                  |
| referrals                  | enrollment_request_id  | enrollment_requests.id | referrals_enrollment_request_id_fkey      |
| submission_reviews         | project_id             | projects.id            | submission_reviews_project_id_fkey        |
| submission_reviews         | submission_id          | project_submissions.id | submission_reviews_submission_id_fkey     |
| typing_indicators          | channel_id             | channels.id            | typing_indicators_channel_id_fkey         |
| unread_messages            | channel_id             | channels.id            | unread_messages_channel_id_fkey           |
| unread_messages            | course_id              | courses.id             | unread_messages_course_id_fkey            |
| video_progress             | course_id              | courses.id             | video_progress_course_id_fkey             |
| video_progress             | video_id               | videos.id              | video_progress_video_id_fkey              |
| videos                     | channel_id             | channels.id            | videos_channel_id_fkey                    |
| videos                     | course_id              | courses.id             | videos_course_id_fkey                     |
| view_scrape_results        | project_id             | projects.id            | view_scrape_results_project_id_fkey       |
| view_scrape_results        | scrape_run_id          | view_scrape_runs.id    | view_scrape_results_scrape_run_id_fkey    |
| view_scrape_results        | submission_id          | project_submissions.id | view_scrape_results_submission_id_fkey    |

---

## 10. Storage Buckets & Policies

### Buckets (6)

| Bucket              | Public | Size Limit | Allowed MIME Types                                                                                                                                       |
| ------------------- | ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| avatars             | Yes    | 2 MB       | image/jpeg, image/png, image/webp, image/gif                                                                                                             |
| chat-media          | Yes    | 10 GB      | image/jpeg, image/jpg, image/png, image/webp, image/gif, video/mp4, video/webm, video/ogg, video/quicktime, video/x-msvideo, video/x-matroska, video/mov |
| course-thumbnails   | Yes    | —          | image/jpeg, image/png, image/webp, image/gif                                                                                                             |
| course-videos       | **No** | —          | video/mp4, video/webm, video/ogg, video/quicktime, video/x-msvideo, video/x-matroska                                                                     |
| payment-screenshots | **No** | 5 MB       | image/jpeg, image/png, image/webp, image/gif                                                                                                             |
| service-images      | Yes    | 5 MB       | image/jpeg, image/png, image/webp, image/gif                                                                                                             |

### Storage Policies (30)

All on `storage.objects`, all PERMISSIVE.

**avatars:**

- Public can view avatars (SELECT, no restriction)
- Users can upload own avatar (INSERT, folder = uid)
- Users can update own avatar (UPDATE, folder = uid)
- Users can delete own avatar (DELETE, folder = uid)

**chat-media:**

- Enrolled users and lecturers can view (SELECT, enrollment/lecturer/admin check)
- Chat media enrolled upload (INSERT, enrolled + folder = uid)
- Chat media lecturer upload (INSERT, course owner + folder = uid)
- Chat media lecturer update (UPDATE, course owner)
- Chat media lecturer delete (DELETE, course owner)
- Chat media owner update (UPDATE, folder = uid)
- Chat media owner delete (DELETE, folder = uid)

**course-thumbnails:**

- Public can view thumbnails (SELECT, no restriction)
- Lecturers can upload thumbnails (INSERT, course owner or lecturer role)
- Lecturers can update own thumbnails (UPDATE, course owner)
- Lecturers can delete own thumbnails (DELETE, course owner)

**course-videos:**

- Enrolled users can view course videos (SELECT, enrollment check)
- Lecturers can view own course videos (SELECT, course owner)
- Admins can view all course videos (SELECT, admin check)
- Public can view course intro videos (SELECT, matches intro_video_url)
- Public can view root intro video (SELECT, name = 'intro-video.mp4')
- Lecturers can upload videos (INSERT, course owner or lecturer role)
- Lecturers can update own videos (UPDATE, course owner)
- Lecturers can delete own videos (DELETE, course owner)

**payment-screenshots:**

- payment_screenshots_select_own (SELECT, folder = uid)
- payment_screenshots_select_admin (SELECT, admin check)
- payment_screenshots_insert_own (INSERT, folder = uid)

**service-images:**

- Public can view service images (SELECT, no restriction)
- Anyone can upload service images (INSERT, no restriction)
- Anyone can update service images (UPDATE, no restriction)
- Anyone can delete service images (DELETE, no restriction)

---

## 11. Extensions

| Extension          | Version |
| ------------------ | ------- |
| pg_cron            | 1.6.4   |
| pg_graphql         | 1.5.11  |
| pg_net             | 0.19.5  |
| pg_stat_statements | 1.11    |
| pgcrypto           | 1.3     |
| plpgsql            | 1.0     |
| supabase_vault     | 0.3.1   |
| uuid-ossp          | 1.1     |

---

## 12. Cron Jobs

| Job ID | Schedule                           | Command                                                       | Active |
| ------ | ---------------------------------- | ------------------------------------------------------------- | ------ |
| 1      | `0 3 * * *` (daily at 3:00 AM UTC) | HTTP POST to `/functions/v1/view-scraper` with scraper secret | Yes    |

---

## 13. Realtime Publications

**14 tables** published to `supabase_realtime`:

| Table                      |
| -------------------------- |
| bundle_enrollment_requests |
| dm_conversations           |
| dm_messages                |
| enrollment_requests        |
| friend_requests            |
| friendships                |
| messages                   |
| notifications              |
| profiles                   |
| project_subscriptions      |
| typing_indicators          |
| view_scrape_results        |
| view_scrape_runs           |
| withdrawal_requests        |

---

## 14. Edge Functions

**29 functions** deployed (all ACTIVE).

| #   | Function                         | verify_jwt | Version |
| --- | -------------------------------- | ---------- | ------- |
| 1   | health                           | false      | 4       |
| 2   | balance                          | true       | 3       |
| 3   | notifications                    | true       | 3       |
| 4   | validate-referral-code           | true       | 3       |
| 5   | notification-read                | true       | 3       |
| 6   | notifications-read-all           | true       | 3       |
| 7   | notifications-unread-count       | true       | 4       |
| 8   | me-enrollments                   | true       | 3       |
| 9   | enrollment-requests              | true       | 3       |
| 10  | withdrawals                      | true       | 4       |
| 11  | bundle-enrollment-requests       | true       | 3       |
| 12  | admin-enrollment-requests        | true       | 5       |
| 13  | admin-enrollment-approve         | true       | 4       |
| 14  | admin-enrollment-reject          | true       | 4       |
| 15  | admin-bundle-enrollment-requests | true       | 5       |
| 16  | admin-bundle-enrollment-approve  | true       | 4       |
| 17  | admin-bundle-enrollment-reject   | true       | 4       |
| 18  | admin-withdrawals                | true       | 5       |
| 19  | admin-withdrawal-approve         | true       | 4       |
| 20  | admin-withdrawal-reject          | true       | 4       |
| 21  | admin-notifications-send         | true       | 3       |
| 22  | course-chats                     | true       | 3       |
| 23  | chat-messages                    | false      | 7       |
| 24  | chat-unread                      | true       | 3       |
| 25  | chat-typing                      | true       | 3       |
| 26  | chat-mute                        | true       | 3       |
| 27  | chat-media                       | true       | 3       |
| 28  | dm-messages                      | true       | 1       |
| 29  | view-scraper                     | false      | 1       |

**Note:** 3 functions have `verify_jwt: false` — `health` (public endpoint), `chat-messages` (handles auth internally), `view-scraper` (called by cron with secret).

---

## 15. Applied Migrations (Supabase)

**22 migrations** tracked by Supabase (remote history):

| Version        | Name                                            |
| -------------- | ----------------------------------------------- |
| 20251231185633 | add_price_non_negative_constraint               |
| 20260108144510 | remove_video_size_limit                         |
| 20260108151505 | enable_realtime_for_approval_tables             |
| 20260108161446 | add_enrollment_expiration                       |
| 20260114132440 | add_additional_performance_indexes              |
| 20260114132450 | optimize_bundle_enrollment_function             |
| 20260115155545 | 083_fix_approve_enrollment_admin_check          |
| 20260115162924 | 084_create_admin_fetch_rpc_functions            |
| 20260115172738 | 085_fix_get_enrollment_requests_admin           |
| 20260115173856 | 086_create_get_bundle_enrollment_requests_admin |
| 20260115174340 | 087_fix_all_admin_request_rpc_functions         |
| 20260115224037 | 088_force_recreate_admin_rpc_functions          |
| 20260123191257 | fix_payment_screenshots                         |
| 20260217154011 | friend_requests_friendships                     |
| 20260217154040 | dm_tables                                       |
| 20260221152544 | add_avatar_url_and_storage_bucket               |
| 20260222123101 | add_update_profile_rpc                          |
| 20260222123102 | add_update_profile_rpc                          |
| 20260224044928 | add_services_table                              |
| 20260224090312 | fix_services_rls                                |
| 20260225125411 | handle_oauth_users_in_trigger                   |
| 20260227141001 | 098_update_own_profile_function                 |

**Note:** Production has 22 Supabase-tracked migrations. Local `main` branch has 105 `.sql` files in `supabase/migrations/` — the difference is because earlier migrations (001-075) were applied directly via SQL editor before Supabase CLI migration tracking was set up. Staging has 132 local migration files (27 more than main, not yet merged).

---

## Validation Summary

| Check                        | Result                              |
| ---------------------------- | ----------------------------------- |
| All SQL queries read-only    | YES — all SELECT / pg_catalog reads |
| Tables from SQL              | 34 (33 tables + 1 view)             |
| RLS policies                 | 142 across 33 tables                |
| Functions/RPCs               | 49 (42 DEFINER, 7 INVOKER)          |
| Triggers                     | 26 across 16 tables                 |
| Indexes                      | 155 across 28 tables                |
| Foreign keys                 | 42 constraints                      |
| Storage buckets              | 6 (4 public, 2 private)             |
| Storage policies             | 30                                  |
| Extensions                   | 8                                   |
| Cron jobs                    | 1 (daily view scraper)              |
| Realtime tables              | 14                                  |
| Edge functions (MCP)         | 29 ACTIVE                           |
| Local edge fn dirs (main)    | 28 + \_shared                       |
| Supabase-tracked migrations  | 22                                  |
| Local migration files (main) | 105                                 |
| Production data modified     | **NONE**                            |

---

_Export generated 2026-03-14. All queries were read-only. No production data was modified._
