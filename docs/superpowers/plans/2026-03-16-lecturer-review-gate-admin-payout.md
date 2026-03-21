# Lecturer Review Gate + Admin Payout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate admin view-bot submissions behind lecturer review, add per-platform payout calculation (views/1000 × RPM), add Pay button on admin side that credits student balance, and change all currency from $ to ₾ (GEL) site-wide.

**Architecture:** The existing `submission_reviews` table already tracks lecturer RPM ratings per platform. We add `payout_amount`, `paid_at`, `paid_by` columns to track admin payments. The admin submissions API filters to only show reviewed submissions with their RPM. The admin UI gets RPM, Payout, and Pay columns. A new API route handles the pay action (balance credit + transaction log + budget deduction). All `$` currency symbols are replaced with `₾` across locales and components.

**Tech Stack:** Next.js 14 API Routes, Supabase (PostgreSQL), TypeScript, SWR, Tailwind CSS, i18n locales (en/ge)

---

## Chunk 1: Database Migration + Currency Fix

### Task 1: Database Migration — Add payout tracking to submission_reviews + expand balance_transactions source

**Files:**

- Create: `supabase/migrations/136_submission_payout_and_currency.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Migration: Add payout tracking to submission_reviews + expand balance_transactions source
-- Description: Adds paid_at, paid_by, payout_amount to submission_reviews.
-- Expands balance_transactions.source CHECK to include 'submission_payout'.

-- Step 1: Add payout tracking columns to submission_reviews
ALTER TABLE public.submission_reviews
ADD COLUMN IF NOT EXISTS payout_amount DECIMAL(10, 2) DEFAULT 0 CHECK (payout_amount >= 0);

ALTER TABLE public.submission_reviews
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.submission_reviews
ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.submission_reviews.payout_amount IS 'Calculated payout: (view_count / 1000) * payment_amount (RPM). Set by admin before payment.';
COMMENT ON COLUMN public.submission_reviews.paid_at IS 'Timestamp when admin executed payout to student balance.';
COMMENT ON COLUMN public.submission_reviews.paid_by IS 'Admin user ID who executed the payout.';

-- Step 2: Create index for unpaid reviews (admin dashboard query)
CREATE INDEX IF NOT EXISTS submission_reviews_unpaid_idx
ON public.submission_reviews(status, paid_at)
WHERE status = 'accepted' AND paid_at IS NULL;

-- Step 3: Expand balance_transactions source CHECK constraint
-- Drop old constraint and recreate with 'submission_payout' added
ALTER TABLE public.balance_transactions
DROP CONSTRAINT IF EXISTS balance_transactions_source_check;

ALTER TABLE public.balance_transactions
ADD CONSTRAINT balance_transactions_source_check
CHECK (source IN ('referral_commission', 'course_purchase', 'withdrawal', 'admin_adjustment', 'submission_payout'));

-- Step 4: Expand balance_transactions reference_type CHECK constraint
ALTER TABLE public.balance_transactions
DROP CONSTRAINT IF EXISTS balance_transactions_reference_type_check;

ALTER TABLE public.balance_transactions
ADD CONSTRAINT balance_transactions_reference_type_check
CHECK (reference_type IN ('enrollment_request', 'withdrawal_request', 'admin_action', 'submission_review'));

-- Step 5: Allow admins to update submission_reviews (for payout tracking)
DROP POLICY IF EXISTS "Admins can update submission reviews for payout" ON public.submission_reviews;
CREATE POLICY "Admins can update submission reviews for payout"
  ON public.submission_reviews FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

- [ ] **Step 2: Apply migration to staging**

Run via Supabase MCP `execute_sql` against staging project `bvptqdmhuumjbyfnjxdt`, or Dashboard SQL editor.
Expected: No errors. Columns appear on `submission_reviews`.

- [ ] **Step 3: Verify columns exist**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'submission_reviews'
AND column_name IN ('payout_amount', 'paid_at', 'paid_by');
```

Expected: 3 rows returned.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/136_submission_payout_and_currency.sql
git commit -m "feat: add payout tracking columns to submission_reviews + expand balance_transactions"
```

---

### Task 2: Currency Fix — Change all $ references to ₾ (GEL) site-wide

**Files:**

- Modify: `locales/en.json` (lines 117, 300, 316, 437, 438, 450, 451)
- Modify: `locales/ge.json` (lines 117, 300, 316, 437, 438, 450, 451)
- Modify: `components/chat/SubmissionReviewDialog.tsx` (lines 521, 533, 603)
- Modify: `components/chat/VideoUploadDialog.tsx` (line 878)

- [ ] **Step 1: Update `locales/en.json`**

Change these keys:

```
Line 117: "saveAmount": "Save ${{amount}}!" → "saveAmount": "Save ₾{{amount}}!"
Line 300: "rpmBadge": "RPM: ${{amount}} ({{count}} platforms)" → "rpmBadge": "RPM: ₾{{amount}} ({{count}} platforms)"
Line 316: "budgetUSD": "Budget (USD)" → "budgetGEL": "Budget (GEL)"
Line 437: "priceLabel": "Price ($) *" → "priceLabel": "Price (₾) *"
Line 438: "originalPriceLabel": "Original Price ($)" → "originalPriceLabel": "Original Price (₾)"
Line 450: "bundlePriceLabel": "Bundle Price ($) *" → "bundlePriceLabel": "Bundle Price (₾) *"
Line 451: "bundleOriginalPriceLabel": "Original Price ($)" → "bundleOriginalPriceLabel": "Original Price (₾)"
```

- [ ] **Step 2: Update `locales/ge.json`**

Same pattern:

```
Line 117: "saveAmount": "დაზოგეთ ${{amount}}!" → "saveAmount": "დაზოგეთ ₾{{amount}}!"
Line 300: "rpmBadge": "RPM: ${{amount}} ({{count}} პლატფორმა)" → "rpmBadge": "RPM: ₾{{amount}} ({{count}} პლატფორმა)"
Line 316: "budgetUSD": "ბიუჯეტი (USD)" → "budgetGEL": "ბიუჯეტი (GEL)"
Line 437: "priceLabel": "ფასი ($) *" → "priceLabel": "ფასი (₾) *"
Line 438: "originalPriceLabel": "ორიგინალური ფასი ($)" → "originalPriceLabel": "ორიგინალური ფასი (₾)"
Line 450: "bundlePriceLabel": "პაკეტის ფასი ($) *" → "bundlePriceLabel": "პაკეტის ფასი (₾) *"
Line 451: "bundleOriginalPriceLabel": "ორიგინალური ფასი ($)" → "bundleOriginalPriceLabel": "ორიგინალური ფასი (₾)"
```

- [ ] **Step 3: Update `SubmissionReviewDialog.tsx` — Change `$` to `₾`**

Line 521: `${criterion.rpm.toFixed(2)} RPM` → `₾${criterion.rpm.toFixed(2)} RPM`
(Note: The first `$` is JSX interpolation, the display text has a literal `$` before the value)
Actually: the line reads `$${criterion.rpm.toFixed(2)} RPM` in JSX → change to `₾${criterion.rpm.toFixed(2)} RPM`

Line 533: `$${currentPaymentAmount.toFixed(2)}` → `₾${currentPaymentAmount.toFixed(2)}`
Line 603: `$${currentLastSavedRPM.toFixed(2)}` → `₾${currentLastSavedRPM.toFixed(2)}`

- [ ] **Step 4: Update `VideoUploadDialog.tsx`**

Line 548: Change `t('projects.budgetUSD')` → `t('projects.budgetGEL')`
Line 878: Change `$${budget}` → `₾${budget}`

- [ ] **Step 5: Search for any remaining `budgetUSD` references and update**

Grep for `budgetUSD` across all `.tsx` and `.ts` files. Update any found references to `budgetGEL`.

- [ ] **Step 6: Commit**

```bash
git add locales/en.json locales/ge.json components/chat/SubmissionReviewDialog.tsx components/chat/VideoUploadDialog.tsx
git commit -m "fix: change all currency from $ to ₾ (GEL) site-wide"
```

---

## Chunk 2: Admin API Changes

### Task 3: Modify admin submissions API — Filter to lecturer-reviewed only + include RPM data

**Files:**

- Modify: `app/api/admin/view-scraper/submissions/route.ts`

- [ ] **Step 1: Update the submissions query to join `submission_reviews`**

In the GET handler, after fetching submissions, also fetch reviews for those submissions. Only return submissions that have at least one `submission_reviews` record with `status = 'accepted'`.

Add to the query output:

- `reviews`: array of `{ platform, payment_amount (RPM), payout_amount, paid_at, paid_by }` per submission

Implementation approach:

1. Keep current query as-is for fetching submissions
2. After getting submission IDs, query `submission_reviews` for those IDs where `status = 'accepted'`
3. Filter submissions to only those with at least one accepted review
4. Attach review data to each submission in the response

```typescript
// After line 71 (const { data: submissions, error } = await query;)

// Fetch accepted reviews for these submissions
const submissionIds = (submissions || []).map((s: any) => s.id);
let reviewMap = new Map<string, any[]>();

if (submissionIds.length > 0) {
  const { data: reviews } = await serviceClient
    .from("submission_reviews")
    .select(
      "id, submission_id, platform, status, payment_amount, payout_amount, paid_at, paid_by",
    )
    .in("submission_id", submissionIds)
    .eq("status", "accepted");

  for (const r of reviews || []) {
    const existing = reviewMap.get(r.submission_id) || [];
    existing.push(r);
    reviewMap.set(r.submission_id, existing);
  }
}
```

Then in the `.filter()` chain (line 102-108), add filter for reviewed submissions:

```typescript
.filter((s: any) => {
  // Must have video URLs
  const hasVideoUrl = s.video_url && s.video_url.trim();
  const hasPlatformLinks = s.platform_links && Object.keys(s.platform_links).length > 0;
  // Must have at least one accepted review
  const hasAcceptedReview = reviewMap.has(s.id);
  return (hasVideoUrl || hasPlatformLinks) && hasAcceptedReview;
})
```

In the `.map()` (line 109-130), add reviews to each submission:

```typescript
reviews: reviewMap.get(s.id) || [],
```

- [ ] **Step 2: Verify the endpoint returns only reviewed submissions with RPM data**

Call: `GET /api/admin/view-scraper/submissions`
Expected: Only submissions with accepted lecturer reviews appear. Each has a `reviews` array with `payment_amount` (RPM) per platform.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/view-scraper/submissions/route.ts
git commit -m "feat: filter admin submissions to lecturer-reviewed only, include RPM data"
```

---

### Task 4: Create admin pay API route

**Files:**

- Create: `app/api/admin/submissions/[id]/pay/route.ts`

- [ ] **Step 1: Write the pay endpoint**

```typescript
import {
  verifyTokenAndGetUser,
  createServiceRoleClient,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/submissions/[id]/pay
 * Body: { review_id: string, payout_amount: number }
 *
 * Pays the student for a specific platform review:
 * 1. Validates review exists, is accepted, not already paid
 * 2. Updates submission_review with payout_amount, paid_at, paid_by
 * 3. Credits student's profiles.balance
 * 4. Creates balance_transaction audit record
 * 5. Deducts from project budget (updates project.budget or tracks via reviews)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const token = getTokenFromHeader(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, error: userError } = await verifyTokenAndGetUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = createServiceRoleClient(token);

    // Check admin
    const { data: isAdmin } = await serviceClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (isAdmin?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { review_id, payout_amount } = body;
    const submissionId = params.id;

    if (!review_id || typeof payout_amount !== "number" || payout_amount <= 0) {
      return NextResponse.json(
        {
          error:
            "Invalid request: review_id and positive payout_amount required",
        },
        { status: 400 },
      );
    }

    // Step 1: Get the review + verify it's valid and unpaid
    const { data: review, error: reviewError } = await serviceClient
      .from("submission_reviews")
      .select(
        "id, submission_id, project_id, status, payment_amount, paid_at, platform",
      )
      .eq("id", review_id)
      .eq("submission_id", submissionId)
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }
    if (review.status !== "accepted") {
      return NextResponse.json(
        { error: "Review is not accepted" },
        { status: 400 },
      );
    }
    if (review.paid_at) {
      return NextResponse.json({ error: "Already paid" }, { status: 409 });
    }

    // Step 2: Get student user_id from submission
    const { data: submission } = await serviceClient
      .from("project_submissions")
      .select("user_id")
      .eq("id", submissionId)
      .single();

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    // Step 3: Get student's current balance
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("balance")
      .eq("id", submission.user_id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Student profile not found" },
        { status: 404 },
      );
    }

    const balanceBefore = parseFloat(profile.balance) || 0;
    const balanceAfter = balanceBefore + payout_amount;
    const roundedPayout = Math.round(payout_amount * 100) / 100;

    // Step 4: Update student balance
    const { error: balanceError } = await serviceClient
      .from("profiles")
      .update({ balance: balanceAfter })
      .eq("id", submission.user_id);

    if (balanceError) {
      console.error("[Pay API] Balance update failed:", balanceError);
      return NextResponse.json(
        { error: "Failed to update balance" },
        { status: 500 },
      );
    }

    // Step 5: Create balance transaction
    const { error: txError } = await serviceClient
      .from("balance_transactions")
      .insert({
        user_id: submission.user_id,
        user_type: "student",
        amount: roundedPayout,
        transaction_type: "credit",
        source: "submission_payout",
        reference_id: review.id,
        reference_type: "submission_review",
        description: `Payout for video submission (${review.platform || "all"} platform)`,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
      });

    if (txError) {
      console.error("[Pay API] Transaction log failed:", txError);
      // Balance was already updated — log but don't fail
    }

    // Step 6: Mark review as paid
    const { error: paidError } = await serviceClient
      .from("submission_reviews")
      .update({
        payout_amount: roundedPayout,
        paid_at: new Date().toISOString(),
        paid_by: user.id,
      })
      .eq("id", review.id);

    if (paidError) {
      console.error("[Pay API] Review paid_at update failed:", paidError);
    }

    return NextResponse.json({
      success: true,
      payout_amount: roundedPayout,
      balance_after: balanceAfter,
      review_id: review.id,
    });
  } catch (err) {
    console.error("[Pay API] Unhandled exception:", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify route responds correctly**

Test with curl or browser:

```
POST /api/admin/submissions/{submissionId}/pay
Body: { "review_id": "...", "payout_amount": 5.25 }
Expected: 200 with { success: true, payout_amount, balance_after, review_id }
```

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/submissions/[id]/pay/route.ts
git commit -m "feat: add admin pay endpoint for student submission payouts"
```

---

## Chunk 3: Frontend — Types + Admin UI

### Task 5: Update TypeScript types

**Files:**

- Modify: `types/view-scraper.ts`

- [ ] **Step 1: Extend `SubmissionWithViews` to include review data**

Add to the interface:

```typescript
export interface SubmissionReviewData {
  id: string;
  platform: string | null;
  payment_amount: number;  // RPM (sum of matched criteria)
  payout_amount: number;   // Calculated: (views/1000) * RPM
  paid_at: string | null;
  paid_by: string | null;
}

// Add to SubmissionWithViews:
reviews: SubmissionReviewData[];
```

- [ ] **Step 2: Commit**

```bash
git add types/view-scraper.ts
git commit -m "feat: add SubmissionReviewData type for payout tracking"
```

---

### Task 6: Update `useViewScraperSubmissions` hook

**Files:**

- Modify: `hooks/useViewScraperSubmissions.ts`

- [ ] **Step 1: No changes needed to the hook itself**

The hook fetches from `/api/admin/view-scraper/submissions` and passes through the response. Since the API now includes `reviews` in the response, the data will flow through automatically. The type update in Task 5 ensures TypeScript knows about the new field.

However, add a realtime subscription for `submission_reviews` changes so the admin UI refreshes when a lecturer reviews something:

```typescript
// Add alongside existing realtime subscription (after line 56)
const reviewChannel = supabase
  .channel("view_scraper_reviews")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "submission_reviews" },
    () => {
      mutate();
    },
  )
  .subscribe();
```

And clean it up in the return:

```typescript
return () => {
  channel.unsubscribe();
  reviewChannel.unsubscribe();
};
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useViewScraperSubmissions.ts
git commit -m "feat: add realtime subscription for submission_reviews in admin hook"
```

---

### Task 7: Update `ViewBotSubmissions` component — Add RPM, Payout, Pay columns

**Files:**

- Modify: `components/ViewBotSubmissions.tsx`
- Modify: `locales/en.json` (add new keys)
- Modify: `locales/ge.json` (add new keys)

- [ ] **Step 1: Add new locale keys for RPM, Payout, Pay**

In both `en.json` and `ge.json`, under the `viewBot` section, add:

```json
// en.json
"rpm": "RPM",
"payout": "Payout",
"pay": "Pay",
"paid": "Paid",
"paying": "Paying...",
"payConfirm": "Pay ₾{{amount}} to {{student}}?",
"paySuccess": "Payment of ₾{{amount}} sent successfully",
"payError": "Payment failed. Please try again.",
"notScraped": "Run bot first",

// ge.json
"rpm": "RPM",
"payout": "გადახდა",
"pay": "გადახდა",
"paid": "გადახდილი",
"paying": "იხდის...",
"payConfirm": "გადაიხადოთ ₾{{amount}} {{student}}-სთვის?",
"paySuccess": "₾{{amount}} წარმატებით გაიგზავნა",
"payError": "გადახდა ვერ მოხერხდა. სცადეთ ხელახლა.",
"notScraped": "ჯერ ბოტი გაუშვით"
```

- [ ] **Step 2: Update `ViewBotSubmissions` component**

Key changes:

1. Add `onPay` callback prop: `onPay: (submissionId: string, reviewId: string, payoutAmount: number, studentName: string) => void`
2. Add `payingId` prop: `payingId: string | null` (review ID being paid)
3. Add table columns: RPM (₾), Payout (₾), Actions (Pay button + Check Now)
4. Calculate payout per platform row: `(views / 1000) * RPM`
5. Pay button: disabled if already paid (`paid_at !== null`), no views yet, or currently paying

For each platform row in the table:

- Find the matching review by platform name
- Show RPM from `review.payment_amount`
- Calculate payout: `(getLatestViews(sub, platform) / 1000) * review.payment_amount`
- Show Pay/Paid button based on `review.paid_at`

The platform matching logic:

```typescript
function getReviewForPlatform(
  sub: SubmissionWithViews,
  platformDisplay: string,
): SubmissionReviewData | null {
  const platformKey = platformDisplay.toLowerCase(); // 'tiktok', 'instagram'
  return (
    sub.reviews?.find(
      (r) => (r.platform || "").toLowerCase() === platformKey,
    ) ||
    sub.reviews?.[0] ||
    null
  ); // fallback to first review if no platform match
}
```

- [ ] **Step 3: Update `AdminViewBot` component to wire up pay handler**

Add `handlePay` callback that calls the pay API:

```typescript
const [payingId, setPayingId] = useState<string | null>(null);

const handlePay = useCallback(
  async (
    submissionId: string,
    reviewId: string,
    payoutAmount: number,
    studentName: string,
  ) => {
    if (!confirm(`Pay ₾${payoutAmount.toFixed(2)} to ${studentName}?`)) return;

    setPayingId(reviewId);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(
        `/api/admin/submissions/${submissionId}/pay`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            review_id: reviewId,
            payout_amount: payoutAmount,
          }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Payment failed");
        return;
      }

      // Refresh submissions data
      // The realtime subscription on submission_reviews will trigger a refresh
    } catch (err) {
      alert("Payment failed. Please try again.");
    } finally {
      setPayingId(null);
    }
  },
  [],
);
```

Pass to ViewBotSubmissions: `onPay={handlePay}` and `payingId={payingId}`.

- [ ] **Step 4: Commit**

```bash
git add components/ViewBotSubmissions.tsx components/AdminViewBot.tsx locales/en.json locales/ge.json
git commit -m "feat: add RPM, payout calculation, and Pay button to admin view bot"
```

---

### Task 8: Update `HistoryRow` colSpan and table headers

**Files:**

- Modify: `components/ViewBotSubmissions.tsx`

- [ ] **Step 1: Update colSpan in HistoryRow**

The HistoryRow currently uses `colSpan={7}`. After adding RPM, Payout, and modifying Actions, update to match the new column count (Student, Project, Video URL, Views, Likes, Comments, RPM, Payout, Actions = 9).

Change line 22-23: `colSpan={7}` → `colSpan={9}`

- [ ] **Step 2: Commit** (combine with Task 7 commit if done together)

---

## Summary of All Changes

| #   | File                                                         | Change                                        |
| --- | ------------------------------------------------------------ | --------------------------------------------- |
| 1   | `supabase/migrations/136_submission_payout_and_currency.sql` | New: payout columns + constraint updates      |
| 2   | `locales/en.json`                                            | Modify: $ → ₾, add viewBot pay keys           |
| 3   | `locales/ge.json`                                            | Modify: $ → ₾, add viewBot pay keys           |
| 4   | `components/chat/SubmissionReviewDialog.tsx`                 | Modify: $ → ₾ on RPM display                  |
| 5   | `components/chat/VideoUploadDialog.tsx`                      | Modify: $ → ₾, budgetUSD → budgetGEL          |
| 6   | `app/api/admin/view-scraper/submissions/route.ts`            | Modify: join reviews, filter to reviewed only |
| 7   | `app/api/admin/submissions/[id]/pay/route.ts`                | New: pay endpoint                             |
| 8   | `types/view-scraper.ts`                                      | Modify: add SubmissionReviewData type         |
| 9   | `hooks/useViewScraperSubmissions.ts`                         | Modify: add reviews realtime subscription     |
| 10  | `components/ViewBotSubmissions.tsx`                          | Modify: RPM + Payout + Pay columns            |
| 11  | `components/AdminViewBot.tsx`                                | Modify: wire up pay handler                   |
