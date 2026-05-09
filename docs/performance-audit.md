# Performance Audit — swavleba.ge

**Date:** 2026-05-09
**Branch audited:** `staging`
**Scope:** Static code analysis only — no live RUM data, no production Supabase queries.
**Stack:** Next.js 14.2.35 (App Router), React 18.3, Supabase (Auth/DB/Realtime/Edge), SWR 2.3, Tailwind 3.4, deployed via DigitalOcean.

---

## 1. Executive summary

The codebase is structurally healthy for performance — dynamic imports are used well, no raw `<img>` tags, realtime subscriptions clean up correctly, image optimization is configured for AVIF/WebP, and security headers don't block performance work. The pain is concentrated in a few specific places:

1. **An 11 MB unreferenced PNG ships in `public/`** — the largest single asset and almost certainly dead weight.
2. **Authenticated API requests pay for two external Supabase Auth round-trips** before any business logic runs (middleware + per-route verification).
3. **Admin analytics fetch unbounded result sets** — fine today, will degrade non-linearly with growth.
4. **No production observability of perf** — no Web Vitals, no error tracking, no bundle analyzer. We're optimizing without instruments.
5. **Aggressive 1-second SWR refetch intervals on admin/notification hooks** overlap with realtime subscriptions for the same data.

> ⚠️ All impact framing below is based on code inspection (chunk sizes on disk, request counts, query shapes, dependency weight) — **not measured RUM data**. Adding instrumentation (§5) before optimizing is strongly recommended so improvements are validated, not assumed.

### Top 5 issues at a glance

| #   | Severity | Issue                                                         | Where                                                |
| --- | -------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | **P0**   | 11 MB unreferenced `font.png` in public assets                | `public/supabase/font.png`                           |
| 2   | **P0**   | Two Supabase Auth API calls per authenticated request         | `middleware.ts` + `lib/supabase-server.ts`           |
| 3   | **P0**   | Admin financial analytics has no `.limit()` on growing tables | `app/api/admin/analytics/financial/route.ts:100-114` |
| 4   | **P1**   | No Web Vitals / bundle analyzer / error tracking installed    | (gap)                                                |
| 5   | **P1**   | 408 KB top JS chunk; heavy client libs not yet attributed     | `.next/static/chunks/2283.*.js`                      |

---

## 2. Frontend bundle & page load

### 2.1 P0 — `public/supabase/font.png` is 11 MB and appears unreferenced

```
public/supabase/font.png    11M   (out of 12M total in public/)
```

A grep across `app/`, `components/`, `styles/`, `public/` and CSS files turned up **zero references** to `font.png`. The only mention of the path in the repo is in `.claude/settings.local.json`. Either it's a screenshot that got committed by accident or it's referenced via a path I didn't find.

**Verify:**

```bash
du -h public/supabase/font.png
grep -rln "font.png" . --exclude-dir=node_modules --exclude-dir=.next
```

**Suggested action (requires explicit approval per CLAUDE.md):** confirm it's unreferenced, then delete. Alternatively move it out of `public/` so it never ships to the CDN.

### 2.2 P1 — Largest first-load JS chunk is 408 KB; bundle composition unknown

`.next/static/chunks/` from the May 7 build:

| Chunk                      | Size  |
| -------------------------- | ----- |
| `2283.da86495fe61a6274.js` | 408 K |
| `2436-f4050352bedebb76.js` | 255 K |
| `3850-8ebe1b2efcaea1d6.js` | 248 K |
| `4033-0c86d97633577602.js` | 200 K |
| `9740.f41a6d2044a517fc.js` | 192 K |
| `9da6db1e-…`               | 183 K |
| `fd9d1056-…`               | 169 K |
| `framework-…`              | 137 K |

Heavy client-side libs in `package.json` likely contributing:

- `recharts` ^3.7 — admin analytics charts; large
- `framer-motion` ^12.38 — animations; large
- `@tiptap/*` (5 packages) — chat rich-text editor; very large
- `lucide-react` ^0.575 — icon library; size depends on tree-shaking
- `posthog-js` ^1.372 — analytics SDK
- `date-fns` ^4.1 — modular but only helps if imported per-function
- `sanitize-html` ^2.17 — HTML safety

**Bundle analyzer is not installed.** Without it, attributing chunk weight is guesswork.

**Verify:**

```bash
ls -lhS .next/static/chunks/ | head -10
```

**Suggested action:** add `@next/bundle-analyzer` and run `ANALYZE=true npm run build` to see the actual composition before deciding what to swap or lazy-load.

### 2.3 P1 — No list virtualization anywhere

Zero usages of `react-window`, `react-virtual`, or `@tanstack/react-virtual`. The largest scroll surfaces are rendered as plain `.map()`:

- `components/lectures/LecturesChannel.tsx` — **1686 lines, 16 `useState` declarations** in one component
- `components/chat/ChatArea.tsx` — 1345 lines
- `hooks/useChatMessages.ts` — 720 lines
- `hooks/useRealtimeMessages.ts` — 500 lines

A user with hundreds of messages pays full DOM cost on every render. Not a problem at small scale; becomes one as channels accumulate history.

### 2.4 P2 — Other public images are heavy for what they are

```
public/wavleba-logo.png       218 K   (logo)
public/payment-step-1.png     317 K   (instructional screenshot)
public/payment-step-2.png     252 K   (instructional screenshot)
public/wavleba-logo-new.png   102 K
public/wavleba-logo.backup.png 16 K   (likely stray backup)
```

`next.config.js:9-13` already enables AVIF + WebP via the image optimizer, but assets in `public/` referenced through plain `<Image src="/foo.png">` will still go through the optimizer at first request. Pre-converting source files cuts both optimization cost and origin storage.

### 2.5 P2 — Provider stack 4 deep at root

`app/layout.tsx:175-206` wraps the app with `PostHogProvider → ThemeProvider → BackgroundProvider → I18nProvider`. If any provider's `value` isn't memoized, every state change triggers a wide re-render. Worth reading those four contexts and confirming each `value` is wrapped in `useMemo`.

### 2.6 Positives worth keeping

- **20 dynamic imports** across `app/` and `components/`. Admin page lazy-loads 9 sub-panels (`app/admin/page.tsx:10-50`). Landing page defers below-the-fold carousels (`app/page.tsx:4-37`). Root layout dynamically loads `PostHogPageView`, `GlobalBackgroundManager`, `ProfileCompletionGuard`, `WelcomeDiscountBanner`, `ReferralCapture` with `ssr: false`.
- **No raw `<img>` tags** found in components — `next/image` used throughout.
- `next/font/google` for Inter with `display: swap`, preload on (`app/layout.tsx`).
- `next.config.js` enables `compress`, `swcMinify`, AVIF/WebP, and 1-year immutable cache on static assets (`next.config.js:96-103`).

---

## 3. API / server / DB

### 3.1 P0 — Two Supabase Auth round-trips per authenticated request

**Path of a typical authenticated API call:**

1. `middleware.ts:20` calls `updateSession(request)`
2. Inside, `lib/supabase/middleware.ts:35` runs `await supabase.auth.getUser()` — a network call to Supabase Auth
3. Request reaches the route handler
4. The handler calls `verifyTokenAndGetUser(token)` from `lib/supabase-server.ts:104` — **another** network call to `/auth/v1/user`

Counts in this codebase:

```
68  API routes set `export const dynamic = 'force-dynamic'`
55  API routes call `verifyTokenAndGetUser`
76  total route handlers in app/api
```

So roughly 55 of 76 routes pay for two Auth calls per request before doing any work. This is the single biggest fixed-cost line on every authenticated endpoint.

**Verify:**

```bash
grep -rl "force-dynamic" app/api | wc -l         # 68
grep -rl "verifyTokenAndGetUser" app/api | wc -l # 55
find app/api -name "route.ts" | wc -l            # 76
```

**Possible fixes (not implementing — just sketching):**

- Have the middleware attach the verified user to a request header, and have routes trust it (carefully — header injection risk if not stripped at the edge).
- Or: skip middleware for `/api/*` and let each route do the single verification it needs.
- Or: cache the JWT verification result in-process for the lifetime of the request.

### 3.2 P0 — Admin financial analytics fetches unbounded result sets

`app/api/admin/analytics/financial/route.ts:90-115`:

```ts
serviceSupabase.from("balance_transactions")
  .select("created_at, amount, source")
  .gte("created_at", fromDate).lte("created_at", toEnd),  // no .limit()

serviceSupabase.from("profiles")
  .select("balance").gt("balance", 0),                      // no date bound, no .limit()

serviceSupabase.from("withdrawal_requests")
  .select("created_at, amount, status")
  .gte("created_at", fromDate).lte("created_at", toEnd),  // no .limit()
```

Today these probably return small result sets and feel fast. As the platform grows, response time grows linearly with users (`profiles.balance > 0`) and transactions per period — and this endpoint loads every time an admin opens analytics. Push the aggregation into SQL (`SUM`, `COUNT`, group-by-day) instead of pulling rows to the Node process.

### 3.3 P1 — Email status endpoint does N+1 calls to Resend

`app/api/admin/emails/status/route.ts:35-71`:

```ts
.limit(20)                                          // 20 history rows
...
const enriched = await Promise.all(
  history.map(async (entry) =>
    resend.emails.get(entry.resend_message_id)      // 1 external API call per row
  ),
);
```

Up to 20 external calls to Resend per request. `Promise.all` parallelizes, but Resend rate-limits and the wall-clock latency is still bounded by the slowest call. Cache `last_event` server-side (Redis is already available — `@upstash/redis` is in `package.json`), or batch via Resend webhook → DB column.

### 3.4 P1 — All API routes are uncached

`middleware.ts:21-22` forces `Cache-Control: no-store, no-cache, must-revalidate` on every non-skipped response, and `next.config.js:118-120` forces `no-store, max-age=0` on `/api/*`. Combined with 68 of 76 routes being `force-dynamic`, **nothing is cacheable at the edge or browser**.

That's the right default for authenticated endpoints, but routes that serve genuinely public, read-mostly data (course catalog, public lecturer profiles, public projects) could safely use `revalidate` or `s-maxage` and offload load from origin.

### 3.5 Positive findings

- **No `.select('*')`** found in `app/api/`. Selects are explicit.
- Comprehensive index history (114+ migrations) — recent migrations like `062_create_course_bundles.sql` add indexes on `user_id`, `status`, `created_at DESC` for hot tables.
- `app/api/admin/analytics/financial/route.ts:34-41` already uses 200-item chunking on `.in()` queries — handles Postgres parameter limits correctly.
- Edge functions delegate to `_shared/supabase.ts` — only `supabase/functions/health/index.ts` re-imports the full client.

---

## 4. Realtime / chat scale

### 4.1 P1 — 20+ concurrent Realtime channels per authenticated user

Channels opened across hooks (sampled from `hooks/useRealtime*.ts` and chat hooks):

```
messages:{channelId}              chat-pins:{channelId}
chat-typing:{channelId}           chat-mute:{channelId}
chat-unread:{channelId}           enrollments:{userId}
notifications:{userId}            friends-updates
dm-conversations                  dm-messages
dm-unread                         profile:{userId}
enrollment_requests:{userId}      bundle_enrollment_requests:{userId}
withdrawal_requests:{userId}      projects-realtime
project-criteria-realtime         submission-reviews:{projectId}
admin-kyc-submissions-live        view_scrape_results_run_{runId}
view_scraper_submissions          view_scraper_reviews
view_scrape_runs_changes
```

Each is a server-side WebSocket subscription. A logged-in admin viewing a lecture page can easily open 15-20 simultaneously. Supabase Realtime scales but per-connection overhead and bandwidth grow linearly.

**Suggested direction (not implementing):** consolidate per-feature channels server-side using `supabase_realtime` publication filters, or gate subscriptions to the currently-active view (don't subscribe to channel pins if the channel isn't on screen).

### 4.2 P1 — No global SWR config; dedup intervals span 240×

Sample `dedupingInterval` values across hooks:

| Interval | Hooks                                                                                         |
| -------- | --------------------------------------------------------------------------------------------- |
| 1 s      | `useAdminLecturerApprovals`, `useAdminKycQueue`, `useUnreadNotifications`, `useNotifications` |
| 5 s      | `useUser`, `useEnrollments`, `useBalance`                                                     |
| 10 s     | `useCourses`, `useLecturerCourses`, `useVideos`                                               |
| 30 s     | `useActiveProjects`                                                                           |
| 60 s     | `usePlatformSettings`                                                                         |
| 240 s    | `useKycSignedUrls`                                                                            |

There is no `<SWRConfig>` wrapping the tree — every hook sets its own values ad-hoc. The 1-second hooks for admin/notifications also have realtime subscriptions covering the same tables, so a row change can trigger both a realtime push and a near-immediate refetch.

**Suggested direction:** add a root `<SWRConfig>` with `revalidateOnFocus: false`, `dedupingInterval: 5000` as the default, and only the few hooks that genuinely need 1 s opt in explicitly with a comment explaining why.

### 4.3 Positive findings

- Realtime cleanup is correct — `supabase.removeChannel()` + ref-nullification on unmount (e.g. `hooks/useRealtimeMessages.ts:281-285`).
- Channels are scoped per-resource (`messages:{channelId}`) rather than firehose-style.

---

## 5. Observability gap (recommend addressing first)

| Capability                        | Status                                            |
| --------------------------------- | ------------------------------------------------- |
| Web Vitals (LCP, INP, CLS, TTFB)  | ❌ no `web-vitals` package, no `reportWebVitals`  |
| Error tracking (Sentry / Datadog) | ❌ none installed                                 |
| Vercel Speed Insights / Analytics | ❌ none                                           |
| Bundle analyzer                   | ❌ no `@next/bundle-analyzer`                     |
| Product analytics                 | ✅ PostHog 1.372 (autocapture + manual pageviews) |
| `/api/metrics` endpoint           | ❌ none                                           |

**Verify:**

```bash
grep -E "web-vitals|@sentry|bundle-analyzer|@vercel/(analytics|speed-insights)" package.json
```

**Recommendation:** before spending engineering hours on §2-§4, install:

1. **`web-vitals`** with a tiny report-to-PostHog hook — ~2 hours, gives real LCP/INP/CLS/TTFB per page per user.
2. **`@next/bundle-analyzer`** — wire it into `next.config.js` behind `ANALYZE=true`. ~30 minutes, makes §2.2 actionable.
3. **(optional) Sentry** for error/performance tracking — ~half a day for the basic install. Without it, server perf regressions are invisible.

This is _measurement scaffolding_, not optimization. The point is to baseline before optimizing so improvements are real, not assumed.

---

## 6. Prioritized punch list

| #   | Sev | Area          | Issue                                                     | Where                                                                                                 | Sketch                                                        | Effort         |
| --- | --- | ------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------- |
| 1   | P0  | Bundle        | 11 MB unreferenced PNG                                    | `public/supabase/font.png`                                                                            | Confirm unreferenced → delete                                 | 5 min          |
| 2   | P0  | API           | Double Auth call per request                              | `middleware.ts`, `lib/supabase-server.ts:104`                                                         | Verify once; pass user via request context                    | 1 day          |
| 3   | P0  | DB            | Unbounded admin analytics queries                         | `app/api/admin/analytics/financial/route.ts:100-114`                                                  | Push aggregation to SQL (`SUM`, `GROUP BY date`)              | 1 day          |
| 4   | P1  | Observability | No Web Vitals / bundle analyzer / Sentry                  | (gap)                                                                                                 | Install `web-vitals`, `@next/bundle-analyzer`, Sentry         | ½–1 day        |
| 5   | P1  | Bundle        | 408 KB top chunk, composition unknown                     | `.next/static/chunks/2283.*.js`                                                                       | Run analyzer, lazy-load `recharts` / `@tiptap` if appropriate | depends on (4) |
| 6   | P1  | API           | N+1 to Resend in email status                             | `app/api/admin/emails/status/route.ts:56-71`                                                          | Cache via Upstash Redis (already in deps) or webhook → DB     | ½ day          |
| 7   | P1  | Bundle        | No virtualization on chat / lecture lists                 | `components/chat/ChatArea.tsx`, `components/lectures/LecturesChannel.tsx`, `hooks/useChatMessages.ts` | Add `@tanstack/react-virtual` to message list                 | 1–2 days       |
| 8   | P1  | Realtime      | 20+ concurrent channels per user                          | `hooks/useRealtime*.ts`                                                                               | Gate subscriptions to active view; consolidate where possible | 1–2 days       |
| 9   | P1  | Data fetching | No global SWR config; 1 s dedup overlapping with realtime | (root)                                                                                                | Add `<SWRConfig>` defaults; require explicit opt-in for <5 s  | ½ day          |
| 10  | P1  | Caching       | All routes `no-store`; public reads can't cache           | `middleware.ts:21`, `next.config.js:118`                                                              | Allow `s-maxage` on read-only public routes                   | ½ day          |
| 11  | P2  | Bundle        | Logo / step PNGs uncompressed                             | `public/wavleba-logo.png` (218 K), `payment-step-{1,2}.png` (317 K / 252 K)                           | Pre-convert to AVIF/WebP                                      | 1 hour         |
| 12  | P2  | Render        | 4-deep provider stack at root                             | `app/layout.tsx:175-206`                                                                              | Memoize each provider's `value`                               | 1 hour         |

---

## 7. Out of scope / not yet measured

- **No live load test or RUM data** — every "impact" claim above is inferred from code, not measured. Section 5 (observability) closes that gap.
- **No production Supabase queries inspected** — per user request, this audit does not touch `nbecbsbuerdtakxkrduw`. Run `EXPLAIN ANALYZE` on staging or production before committing to any DB-side change.
- **DB index health vs. actual query plans** not verified — recent migrations show indexes being added, but I did not check that the indexes match the actual query predicates used by the routes flagged in §3.
- **Edge function cold-start cost** not measured — the inventory in §3.5 says only 1 of 28 functions imports the full SDK, but that doesn't quantify cold-start latency on Deno deploy.
- **Realtime fanout cost on Supabase side** not measured — a per-connection cost analysis would require Supabase dashboard / billing inspection.

---

## Appendix: reproducible verification commands

```bash
# Asset sizes
du -h public/supabase/font.png
du -sh public/
ls -lhS public/*.png | head -10

# Bundle output
ls -lhS .next/static/chunks/ | head -10

# API surface
find app/api -name "route.ts" | wc -l
grep -rl "force-dynamic" app/api | wc -l
grep -rl "verifyTokenAndGetUser" app/api | wc -l
grep -rn "\.select('\*')" app/api lib | wc -l

# Observability gaps
grep -E "web-vitals|@sentry|bundle-analyzer|@vercel/(analytics|speed-insights)" package.json

# Reference checks
grep -rln "font.png" . --exclude-dir=node_modules --exclude-dir=.next
```
