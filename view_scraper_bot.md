# View Scraper Bot — Technical Specification

## Overview

Automated bot that fetches video view counts from **TikTok** and **Instagram** using **Apify** scrapers. Runs daily on a schedule, with on-demand manual triggers from the admin dashboard. Results are stored historically and displayed in real-time.

**Purpose:** Display-only — shows view counts to admin/lecturers. No auto-approval or automated events. Just data.

**Supported Platforms (v1):** TikTok, Instagram
**Future Platforms:** YouTube, Facebook (can be added later with minimal changes)

---

## How It Fits Into the Existing System

Students already submit video URLs via `VideoSubmissionDialog` when responding to projects in chat. Each submission can include **multiple platform links** (one field per platform — e.g., a TikTok link AND an Instagram link in the same submission). Projects already define `min_views`, `max_views`, and `platforms[]` fields.

**The bot reads those URLs, sends them to Apify, stores the returned view counts, and displays them in the admin dashboard.**

---

## Why Apify (Not DIY Scraping or Official APIs)

| Approach | Problem |
|----------|---------|
| TikTok official API | Research API requires special application, often rejected. oEmbed returns no view counts. |
| Instagram official API | Graph API only works for business accounts connected to your app. Useless for student content. |
| Direct HTML scraping | Fragile — TikTok/Instagram change HTML structure regularly. Login walls, CAPTCHAs, IP bans. We'd maintain parsers forever. |
| **Apify** | Pre-built, community-maintained scrapers. Handles IP rotation, CAPTCHAs, browser emulation. We just send URLs and get data back. |

### Apify at Our Scale

| Metric | Value |
|--------|-------|
| New videos/day | 10-20 |
| Daily re-checks (active submissions) | ~50-200 |
| Monthly total | ~300-600 scrapes |
| Apify free tier | **5,000 results/month** |
| Headroom | 8-16x our volume |
| Cost | **$0/month** (free tier). $5/mo if we ever exceed 5,000. |

---

## Apify Integration

### TikTok

**Actor:** `clockworks/free-tiktok-scraper`

```typescript
// Start scrape run
const run = await fetch('https://api.apify.com/v2/acts/clockworks~free-tiktok-scraper/run-sync-get-dataset-items', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${APIFY_API_TOKEN}`
  },
  body: JSON.stringify({
    postURLs: ['https://www.tiktok.com/@user/video/7123456789'],
    resultsPerPage: 1
  })
});

// Response includes:
{
  "playCount": 45200,       // ← VIEWS
  "diggCount": 1200,        // ← LIKES
  "commentCount": 89,       // ← COMMENTS
  "shareCount": 34,         // ← SHARES
  "collectCount": 56        // ← SAVES
}
```

**Handles:** Full URLs, short URLs (`vm.tiktok.com/...`), all TikTok URL formats.

### Instagram

**Actor:** `apify/instagram-scraper`

```typescript
const run = await fetch('https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${APIFY_API_TOKEN}`
  },
  body: JSON.stringify({
    directUrls: ['https://www.instagram.com/reel/ABC123/'],
    resultsType: 'posts'
  })
});

// Response includes:
{
  "videoViewCount": 12400,   // ← VIEWS
  "likesCount": 890,         // ← LIKES
  "commentsCount": 45        // ← COMMENTS
}
```

**Handles:** Reels, posts, IGTV, all Instagram URL formats. Works even for content behind login walls.

### Batching

Both actors accept **arrays of URLs**, so we batch all TikTok URLs into one call and all Instagram URLs into another. This is more efficient and counts as fewer API calls against the Apify quota.

```
Per bot run:
  1 Apify call for all TikTok URLs (e.g., 15 URLs in one batch)
  1 Apify call for all Instagram URLs (e.g., 8 URLs in one batch)
  = 2 Apify calls total, regardless of URL count
```

---

## Database Schema

### New Table: `view_scrape_results`

```sql
CREATE TABLE public.view_scrape_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   UUID NOT NULL REFERENCES project_submissions(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  scrape_run_id   UUID REFERENCES view_scrape_runs(id),
  platform        TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram')),
  video_url       TEXT NOT NULL,
  view_count      BIGINT,               -- null if fetch failed
  like_count      BIGINT,               -- null if unavailable
  comment_count   BIGINT,               -- null if unavailable
  share_count     BIGINT,               -- TikTok only
  save_count      BIGINT,               -- TikTok collectCount
  error_message   TEXT,                  -- null on success, error details on failure
  scraped_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_view_scrape_submission ON view_scrape_results(submission_id, platform, scraped_at DESC);
CREATE INDEX idx_view_scrape_project ON view_scrape_results(project_id, scraped_at DESC);
CREATE INDEX idx_view_scrape_run ON view_scrape_results(scrape_run_id);

-- RLS
ALTER TABLE view_scrape_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all scrape results"
  ON view_scrape_results FOR SELECT
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

CREATE POLICY "Lecturers can view their project scrape results"
  ON view_scrape_results FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Students can view own scrape results"
  ON view_scrape_results FOR SELECT
  USING (user_id = auth.uid());

-- Edge Function inserts via service_role key (bypasses RLS)
```

### New Table: `view_scrape_runs`

Tracks each bot execution (scheduled or manual).

```sql
CREATE TABLE public.view_scrape_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by    UUID REFERENCES auth.users(id),  -- null = scheduled, user_id = manual
  trigger_type    TEXT NOT NULL CHECK (trigger_type IN ('scheduled', 'manual')),
  status          TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  total_urls      INTEGER DEFAULT 0,
  successful      INTEGER DEFAULT 0,
  failed          INTEGER DEFAULT 0,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  error_log       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE view_scrape_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage scrape runs"
  ON view_scrape_runs FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

-- Enable realtime for live progress
ALTER PUBLICATION supabase_realtime ADD TABLE view_scrape_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE view_scrape_results;
```

### Modify Existing: `project_submissions`

Cache latest view data per submission for quick display:

```sql
ALTER TABLE project_submissions
  ADD COLUMN IF NOT EXISTS latest_views    JSONB DEFAULT '{}',
  -- Example: {"tiktok": {"view_count": 12400, "like_count": 890, "scraped_at": "..."}, "instagram": {...}}
  ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMPTZ;
```

JSONB because submissions can have multiple platform links, each with its own view count.

---

## Architecture

### Edge Function: `view-scraper`

```
supabase/functions/view-scraper/index.ts
```

**Invocation Methods:**

| Method | Trigger | Use Case |
|--------|---------|----------|
| **Scheduled (daily)** | `pg_cron` at 03:00 UTC | Automatic daily checks |
| **Manual (admin)** | `POST /api/admin/view-scraper/run` | Admin clicks "Run Bot Now" |
| **Single check** | `POST /api/admin/view-scraper/check` with `submission_id` | Admin clicks "Check Now" on one row |

### Edge Function Flow

```
START
  │
  ├─ 1. Auth: verify service_role key or admin JWT
  │
  ├─ 2. Create view_scrape_runs record (status: 'running')
  │
  ├─ 3. Query active submissions:
  │     SELECT ps.*, p.min_views, p.platforms, p.end_date
  │     FROM project_submissions ps
  │     JOIN projects p ON ps.project_id = p.id
  │     WHERE (p.end_date IS NULL OR p.end_date >= now())
  │
  ├─ 4. Group URLs by platform:
  │     tiktokUrls = [url1, url2, ...]
  │     instagramUrls = [url1, url2, ...]
  │
  ├─ 5. Send to Apify (2 API calls total):
  │     - Batch all TikTok URLs → Apify TikTok actor
  │     - Batch all Instagram URLs → Apify Instagram actor
  │
  ├─ 6. Match Apify results back to submissions:
  │     - INSERT each result into view_scrape_results (triggers realtime)
  │     - UPDATE project_submissions.latest_views JSONB cache
  │
  ├─ 7. Update view_scrape_runs → status: 'completed' (triggers realtime)
  │
  └─ 8. Return summary: { run_id, successful, failed }
END
```

### Scheduling with pg_cron

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'daily-view-scrape',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bvptqdmhuumjbyfnjxdt.supabase.co/functions/v1/view-scraper',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"trigger": "scheduled"}'::jsonb
  );
  $$
);
```

---

## URL Parsing

```typescript
// lib/video-url-parser.ts

type Platform = 'tiktok' | 'instagram';

interface ParsedVideoURL {
  platform: Platform;
  originalUrl: string;
}

// TikTok patterns (Apify handles all of these natively):
//   https://www.tiktok.com/@username/video/7123456789012345678
//   https://vm.tiktok.com/ZMrABC123/
//   https://www.tiktok.com/t/ZMrABC123/

// Instagram patterns (Apify handles all of these natively):
//   https://www.instagram.com/reel/ABC123xyz/
//   https://www.instagram.com/p/ABC123xyz/
//   https://www.instagram.com/tv/ABC123xyz/

// We just need to detect which platform a URL belongs to.
// Apify handles short URL resolution, login walls, etc. internally.
```

Since Apify handles URL resolution internally, our parser only needs to **detect the platform** from the URL — no video ID extraction or redirect following needed.

---

## API Routes

### `POST /api/admin/view-scraper/run`
Trigger full bot run. Admin only.
```typescript
// Request body: { project_id?: string }
// Response: { run_id: string, status: 'started' }
```

### `POST /api/admin/view-scraper/check`
Check a single submission. Admin only.
```typescript
// Request body: { submission_id: string }
// Response: { run_id: string, status: 'started' }
```

### `GET /api/admin/view-scraper/runs`
List all bot runs (history). Admin only.
```typescript
// Response: { runs: ViewScrapeRun[] }
```

### `GET /api/admin/view-scraper/submissions`
All video link submissions with latest view data. Admin only.
```typescript
// Query params: ?project_id=xxx&platform=tiktok
// Response: { submissions: SubmissionWithViews[] }
```

### `GET /api/admin/view-scraper/history/[submissionId]`
View count history for one submission. Admin only.
```typescript
// Response: { history: ViewScrapeResult[] }
```

---

## Admin Dashboard — New Tab: "View Bot"

### Tab Position

```
Overview | Enrollments | Bundles | Project Subs | View Bot | Withdrawals | Courses | ...
```

### Sub-tabs

#### 1. Dashboard (default)

**Stats Cards:**
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Total Links   │  │ TikTok Links │  │ Instagram    │  │ Last Run     │
│     47        │  │     32       │  │     15       │  │ 3h ago       │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

**"Run Bot Now" Button** (top right):
- Click → starts bot → shows live progress
- Progress updates via Supabase Realtime on `view_scrape_runs` + `view_scrape_results`

**Recent Runs Table:**
| Triggered By | Type | URLs Checked | Success | Failed | Duration | Status |
|-------------|------|-------------|---------|--------|----------|--------|
| Admin Name | Manual | 47 | 45 | 2 | 12s | Completed |
| System | Scheduled | 45 | 44 | 1 | 10s | Completed |

#### 2. All Submissions

Filterable table of every video link submitted to any project.

**Filters:**
- Project dropdown
- Platform filter (TikTok / Instagram)
- Date range

**Table:**
| Student | Project | Platform | Video URL | Views | Likes | Comments | Last Checked | Actions |
|---------|---------|----------|-----------|-------|-------|----------|-------------|---------|
| John D. | Campaign X | TikTok | tiktok.com/... | 12,400 | 890 | 45 | 2h ago | [Check Now] |
| Jane S. | Campaign X | Instagram | instagram.com/... | 3,200 | 210 | 12 | 2h ago | [Check Now] |

- **Click row** → expands to show view count history over time
- **"Check Now"** → immediately re-scrapes that single URL via Apify

#### 3. By Project

Group submissions by project:

```
┌──────────────────────────────────────────────────┐
│ Project: "Spring Campaign 2026"                  │
│ Course: Marketing 101                            │
│ Min Views: 5,000 | Platforms: TikTok, Instagram  │
│ Submissions: 12 | Avg Views: 8,400              │
│                                                  │
│  [View Submissions]  [Check This Project]        │
└──────────────────────────────────────────────────┘
```

---

## Hooks

### `useViewScraperRuns`
```typescript
// hooks/useViewScraperRuns.ts
// Fetches run history + realtime subscription for live progress
// Returns: { runs, activeRun, isRunning, triggerRun }
```

### `useViewScraperSubmissions`
```typescript
// hooks/useViewScraperSubmissions.ts
// Fetches all submissions with latest view data, supports filters
// Returns: { submissions, isLoading, filters, setFilters }
```

### `useSubmissionViewHistory`
```typescript
// hooks/useSubmissionViewHistory.ts
// Fetches scrape history for one submission (for the expanded row)
// Returns: { history, isLoading }
```

### `useViewScraperLive`
```typescript
// hooks/useViewScraperLive.ts
// Realtime subscription during active run
// Returns: { progress, latestResult, isActive }
```

---

## Realtime Updates

Admin dashboard gets live updates via Supabase Realtime:

```typescript
supabase
  .channel('view-scraper-live')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'view_scrape_results',
    filter: `scrape_run_id=eq.${activeRunId}`
  }, (payload) => {
    // New result → update progress counter + results table
  })
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'view_scrape_runs',
    filter: `id=eq.${activeRunId}`
  }, (payload) => {
    // Run completed/failed
  })
  .subscribe();
```

---

## Environment Variables

```bash
# Apify — free tier (5,000 results/month)
APIFY_API_TOKEN=apify_api_...    # From https://console.apify.com/account#/integrations

# Internal auth for scheduled runs
VIEW_SCRAPER_SECRET=...           # Shared secret for pg_cron → Edge Function
```

That's it. Two env vars. No platform API keys needed.

---

## Edge Function Pseudocode

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  const { trigger, triggered_by, project_id, submission_id } = await req.json();

  // 1. Create run record
  const { data: run } = await supabase.from('view_scrape_runs').insert({
    trigger_type: trigger,
    triggered_by,
    status: 'running'
  }).select().single();

  // 2. Fetch active submissions
  let query = supabase
    .from('project_submissions')
    .select('*, projects!inner(min_views, platforms, end_date)')
    .or('projects.end_date.is.null,projects.end_date.gte.now()');

  if (project_id) query = query.eq('project_id', project_id);
  if (submission_id) query = query.eq('id', submission_id);

  const { data: submissions } = await query;

  // 3. Group URLs by platform
  const tiktokBatch = [];   // { url, submission }
  const instagramBatch = [];

  for (const sub of submissions) {
    const urls = extractVideoUrls(sub);
    for (const { platform, originalUrl } of urls) {
      if (platform === 'tiktok') tiktokBatch.push({ url: originalUrl, submission: sub });
      if (platform === 'instagram') instagramBatch.push({ url: originalUrl, submission: sub });
    }
  }

  let successful = 0, failed = 0;

  // 4. Scrape TikTok batch (one Apify call)
  if (tiktokBatch.length > 0) {
    const tiktokResults = await apifyScrapeTikTok(tiktokBatch.map(b => b.url));
    for (let i = 0; i < tiktokBatch.length; i++) {
      const result = tiktokResults[i];
      const sub = tiktokBatch[i].submission;

      if (result && result.playCount != null) {
        await saveResult(run.id, sub, 'tiktok', tiktokBatch[i].url, {
          view_count: result.playCount,
          like_count: result.diggCount,
          comment_count: result.commentCount,
          share_count: result.shareCount,
          save_count: result.collectCount,
        });
        successful++;
      } else {
        await saveError(run.id, sub, 'tiktok', tiktokBatch[i].url, 'No data returned');
        failed++;
      }
    }
  }

  // 5. Scrape Instagram batch (one Apify call)
  if (instagramBatch.length > 0) {
    const igResults = await apifyScrapeInstagram(instagramBatch.map(b => b.url));
    for (let i = 0; i < instagramBatch.length; i++) {
      const result = igResults[i];
      const sub = instagramBatch[i].submission;

      if (result && result.videoViewCount != null) {
        await saveResult(run.id, sub, 'instagram', instagramBatch[i].url, {
          view_count: result.videoViewCount,
          like_count: result.likesCount,
          comment_count: result.commentsCount,
          share_count: null,
          save_count: null,
        });
        successful++;
      } else {
        await saveError(run.id, sub, 'instagram', instagramBatch[i].url, 'No data returned');
        failed++;
      }
    }
  }

  // 6. Complete the run
  await supabase.from('view_scrape_runs').update({
    status: 'completed',
    total_urls: successful + failed,
    successful,
    failed,
    completed_at: new Date().toISOString()
  }).eq('id', run.id);

  return new Response(JSON.stringify({ run_id: run.id, successful, failed }));
});

// --- Apify helpers ---

async function apifyScrapeTikTok(urls: string[]) {
  const res = await fetch(
    'https://api.apify.com/v2/acts/clockworks~free-tiktok-scraper/run-sync-get-dataset-items?token=' + APIFY_API_TOKEN,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postURLs: urls, resultsPerPage: 1 })
    }
  );
  return await res.json();
}

async function apifyScrapeInstagram(urls: string[]) {
  const res = await fetch(
    'https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=' + APIFY_API_TOKEN,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directUrls: urls, resultsType: 'posts' })
    }
  );
  return await res.json();
}

async function saveResult(runId, submission, platform, url, stats) {
  // Insert scrape result
  await supabase.from('view_scrape_results').insert({
    submission_id: submission.id,
    project_id: submission.project_id,
    user_id: submission.user_id,
    scrape_run_id: runId,
    platform,
    video_url: url,
    ...stats,
  });

  // Update cached JSONB on submission
  const views = submission.latest_views || {};
  views[platform] = { ...stats, scraped_at: new Date().toISOString() };
  await supabase.from('project_submissions').update({
    latest_views: views,
    last_scraped_at: new Date().toISOString()
  }).eq('id', submission.id);
}

async function saveError(runId, submission, platform, url, error) {
  await supabase.from('view_scrape_results').insert({
    submission_id: submission.id,
    project_id: submission.project_id,
    user_id: submission.user_id,
    scrape_run_id: runId,
    platform,
    video_url: url,
    error_message: error,
  });
}
```

---

## Implementation Order

### Phase 1 — Database + Apify Core
1. Create migration: `view_scrape_results`, `view_scrape_runs` tables + `project_submissions` alterations
2. Set up Apify free account, get API token, store as Edge Function secret
3. Build `lib/video-url-parser.ts` (platform detection from URLs)
4. Build Edge Function `view-scraper` with Apify integration
5. Deploy to staging, test: submit a TikTok + Instagram URL → trigger bot → verify view counts stored

### Phase 2 — API Routes + Admin UI
6. Build API routes: `run`, `check`, `runs`, `submissions`, `history`
7. Add "View Bot" tab to admin dashboard
8. Build Dashboard sub-tab (stats, "Run Bot Now", run history)
9. Build All Submissions sub-tab (filterable table, "Check Now" per row)
10. Build By Project sub-tab (grouped view)
11. Wire Realtime subscriptions for live progress

### Phase 3 — Scheduling
12. Enable `pg_cron` + `pg_net` extensions on staging
13. Set up daily scheduled trigger at 03:00 UTC
14. Monitor first few automatic runs

### Phase 4 — Future (when needed)
15. Add YouTube support (official API — free, easy)
16. Add Facebook support
17. Add fraud detection (suspicious view spikes)

---

## Data Structure Ready for Fraud Detection (Future)

The `view_scrape_results` table stores every scrape with timestamps, creating a time series:

```
submission_id | platform | view_count | scraped_at
-------------------------------------------------
abc-123       | tiktok   | 100        | Mar 1, 03:00
abc-123       | tiktok   | 150        | Mar 2, 03:00
abc-123       | tiktok   | 12,000     | Mar 3, 03:00   ← suspicious spike
abc-123       | tiktok   | 12,100     | Mar 4, 03:00
```

No schema changes needed when fraud detection is added — the historical data is already there.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Apify actor breaks/unmaintained | Scraping stops | Switch to alternative actor (many TikTok/IG scrapers on Apify marketplace). Or add direct HTML scraping as fallback. |
| Apify free tier exceeded | Scraping stops until next month | Upgrade to $5/mo (100k results). Very unlikely at our volume. |
| Apify API slow/down | Bot run takes long or fails | Timeout handling + retry on next scheduled run. Store partial results. |
| Student submits private video | No data returned | Store error, admin sees "Failed" in dashboard. |
| Edge Function timeout | Large batch can't finish | Apify's `run-sync` has its own timeout. For large batches, split into chunks of 20 URLs. |

---

## Resolved Decisions

| Decision | Answer |
|----------|--------|
| Which platforms? | TikTok + Instagram (v1). YouTube + Facebook later. |
| Scraping method? | Apify only. No DIY HTML parsing. Simple, reliable, free at our scale. |
| What happens when views meet threshold? | Nothing. Display-only. No auto-approval. |
| Multiple platforms per submission? | Yes. Each platform has its own link field. Views tracked independently. |
| Check expired projects? | No. Only active projects (end_date is null or in the future). |
| Fraud detection? | Not in v1. Data structure supports it for later. |
| Volume? | 10-20 new videos/day. ~300-600 checks/month. |
| Cost? | **$0/month** — Apify free tier (5,000/month) covers us with 8-16x headroom. |
