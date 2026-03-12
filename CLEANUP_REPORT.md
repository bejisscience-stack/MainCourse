# Swavleba Cleanup Report

Generated: 2026-03-12

---

## HIGH CONFIDENCE — Safe to delete (no code references)

### Orphaned Components (10 files)
Files with zero imports anywhere in the codebase:

| File | Description |
|------|-------------|
| `components/AIParticles.tsx` | Unused animation component |
| `components/BackgroundSelector.tsx` | Unused background picker |
| `components/BitcoinDrops.tsx` | Unused animation component |
| `components/DataSignals.tsx` | Unused animation component |
| `components/FloatingButton.tsx` | Unused floating button |
| `components/ScrollChart.tsx` | Unused chart component |
| `components/SimpleBackgroundAnimation.tsx` | Unused animation component |
| `components/SocialIconFlow.tsx` | Unused animation component |
| `components/TestBackgroundAnimations.tsx` | Test page for animations |
| `components/chat/MemberSidebar.tsx` | Unused chat sidebar variant |

### Unused Hooks (3 files)
Hooks with zero imports anywhere in the codebase:

| File | Description |
|------|-------------|
| `hooks/useMembers.ts` | Unused members hook |
| `hooks/useMessages.ts` | Unused messages hook |
| `hooks/useWindowDimensions.ts` | Unused window dimensions hook |

### Orphaned Edge Functions (13 functions)
All replaced by equivalent Next.js API routes. Zero calls from frontend, hooks, or other code:

| Edge Function | Replaced By |
|---------------|-------------|
| `admin-bundle-enrollment-approve` | `app/api/admin/bundle-enrollment-requests/[id]/approve/route.ts` |
| `admin-bundle-enrollment-reject` | `app/api/admin/bundle-enrollment-requests/[id]/reject/route.ts` |
| `admin-enrollment-approve` | `app/api/admin/enrollment-requests/[id]/approve/route.ts` |
| `admin-enrollment-reject` | `app/api/admin/enrollment-requests/[id]/reject/route.ts` |
| `admin-notifications-send` | `app/api/admin/notifications/send/route.ts` |
| `admin-withdrawal-approve` | `app/api/admin/withdrawals/[requestId]/approve/route.ts` |
| `admin-withdrawal-reject` | `app/api/admin/withdrawals/[requestId]/reject/route.ts` |
| `admin-withdrawals` | `app/api/admin/withdrawals/route.ts` |
| `course-chats` | `app/api/courses/[courseId]/chats/route.ts` |
| `me-enrollments` | `app/api/me/enrollments/route.ts` |
| `notification-read` | `app/api/notifications/[id]/read/route.ts` |
| `notifications-read-all` | `app/api/notifications/read-all/route.ts` |
| `notifications-unread-count` | `app/api/notifications/unread-count/route.ts` |

### Stale Config (1 file)

| File | Reason |
|------|--------|
| `vercel.json` | Project is hosted on DigitalOcean, not Vercel |

---

## MEDIUM CONFIDENCE — Likely safe but verify with user

### Unused Database Tables (0 rows, 0 code references outside migrations)

| Table | Notes |
|-------|-------|
| `services` | No code references. Appears to be an abandoned feature. |
| `friendships` | No code references. Abandoned social feature. |
| `dm_conversations` | No code references. Abandoned DM feature. |
| `dm_messages` | No code references. Abandoned DM feature. |

**Note:** These tables have associated migrations. We will NOT drop them or delete migrations. They can be left in the DB as empty tables, or dropped in a future cleanup with explicit approval.

### Unused PostHog Integration

| Item | Details |
|------|---------|
| `contexts/PostHogContext.tsx` | Provider exists and is wrapped in `app/layout.tsx`, but no tracking calls (`posthog.capture()`, `posthog.identify()`) exist anywhere |
| `posthog-js` npm package | Installed but only used by the inactive provider |
| `NEXT_PUBLIC_POSTHOG_KEY` env var | Defined in `.env.local` but effectively unused |
| `NEXT_PUBLIC_POSTHOG_HOST` env var | Defined in `.env.local` but effectively unused |

**Decision needed:** Remove PostHog entirely, or keep it for future use? Removing saves ~50KB bundle size.

---

## NOT REMOVING — Actively used despite 0 rows

These tables have 0 rows but are actively referenced in code:

| Table | Used By |
|-------|---------|
| `saved_cards` | `hooks/useSavedCards.ts`, `components/EnrollmentModal.tsx`, payment API routes |
| `muted_users` | `hooks/useMuteStatus.ts`, chat edge functions |
| `course_bundles` | `app/bundles/[bundleId]/page.tsx`, lecturer dashboard |
| `course_bundle_items` | Bundle detail page, lecturer dashboard |
| `bundle_enrollments` | Bundle enrollment flow, admin dashboard |
| `bundle_enrollment_requests` | Full enrollment workflow with real-time subscriptions |

---

## CLEAN — No issues found

| Category | Result |
|----------|--------|
| Commented-out code blocks (10+ lines) | None found |
| Unused npm packages | None found (all packages have code references) |
| Stale config files (besides vercel.json) | None found |

---

## Deletion Order

1. **Components & hooks** (10 + 3 files) — delete, verify build
2. **Stale config** (vercel.json) — delete
3. **Edge function source code** (13 directories) — delete from repo only; deployed functions stay on Supabase until manually removed
4. **PostHog** (if approved) — remove provider from layout, delete context file, uninstall package, remove env vars
5. **Database tables** (if approved) — NOT deleting in this pass; just documenting
