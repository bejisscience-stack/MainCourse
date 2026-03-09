# Technical Implementation — Project Subscription System + Bug Fixes

**Status**: In Progress
**Last Updated**: 2026-02-28
**Author**: Claude Code

---

## Overview

Complete implementation of Project Subscription System (₾10/month project submission access) + course lifetime access fixes + 3 bug fixes. This is a new subsystem allowing students to purchase recurring project submission access independently of course enrollment.

**Key Decision**: Users get 1-month initial `project_access_expires_at` on their first-ever course approval; they can renew via `project_subscriptions` table.

---

## Database Schema Changes (Migration 099)

### 1. Backfill Enrollments for Lifetime Access
```sql
UPDATE public.enrollments SET expires_at = NULL WHERE expires_at IS NOT NULL;
```
**Rationale**: Migration 080 added 1-month expiry; this reverts to intended lifetime behavior.

### 2. Add Project Access Column to Profiles
```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS project_access_expires_at TIMESTAMPTZ NULL;
```
**Semantics**:
- `NULL` = no access yet (or already granted once, expired, needs subscription)
- Timestamp = access valid until this time

### 3. New Table: project_subscriptions
```sql
CREATE TABLE IF NOT EXISTS public.project_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  price DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  payment_screenshot TEXT NOT NULL,  -- URL to storage bucket
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'expired', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.project_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscriptions"
  ON public.project_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own subscriptions"
  ON public.project_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.project_subscriptions;
```

**Access Rules**:
- `status = 'pending'`: admin review only
- `status = 'active'`: grant project submission access
- `status = 'expired'`: access revoked (show expiry date in UI)
- `status = 'rejected'`: user can submit new request after 30 days (UI rule, not enforced in DB)

### 4. Update: approve_enrollment_request() RPC
**Change**: Modify to grant 1-month `project_access_expires_at` on FIRST enrollment only.

```sql
CREATE OR REPLACE FUNCTION approve_enrollment_request(request_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_request enrollment_requests%ROWTYPE;
  v_course courses%ROWTYPE;
  v_referral referrals%ROWTYPE;
  v_commission DECIMAL;
  v_referrer_amount DECIMAL;
  v_lecturer_amount DECIMAL;
  v_is_first_enrollment BOOLEAN;
BEGIN
  IF NOT check_is_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_request FROM enrollment_requests WHERE id = request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  SELECT * INTO v_course FROM courses WHERE id = v_request.course_id;

  -- Commission distribution (unchanged)
  SELECT r.* INTO v_referral FROM referrals r
    WHERE r.enrollment_request_id = request_id LIMIT 1;

  IF FOUND AND v_course.referral_commission_percentage > 0 THEN
    v_commission := (v_course.referral_commission_percentage::DECIMAL / 100) * v_course.price;
    v_referrer_amount := v_commission;
    v_lecturer_amount := v_course.price - v_commission;
    PERFORM credit_user_balance(v_referral.referrer_id, v_referrer_amount, 'referral_commission', request_id::TEXT);
    PERFORM credit_user_balance(v_course.lecturer_id, v_lecturer_amount, 'course_sale', request_id::TEXT);
  ELSE
    PERFORM credit_user_balance(v_course.lecturer_id, v_course.price, 'course_sale', request_id::TEXT);
  END IF;

  UPDATE enrollment_requests SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW()
    WHERE id = request_id;

  -- INSERT enrollment (lifetime: no expires_at)
  INSERT INTO enrollments (user_id, course_id, approved_at)
    VALUES (v_request.user_id, v_request.course_id, NOW())
    ON CONFLICT (user_id, course_id) DO UPDATE SET approved_at = NOW();

  -- Grant project_access_expires_at on FIRST enrollment only
  SELECT NOT EXISTS (
    SELECT 1 FROM enrollments WHERE user_id = v_request.user_id AND course_id != v_request.course_id
  ) INTO v_is_first_enrollment;

  IF v_is_first_enrollment THEN
    UPDATE profiles SET project_access_expires_at = NOW() + INTERVAL '1 month'
      WHERE id = v_request.user_id AND project_access_expires_at IS NULL;
  END IF;

  PERFORM create_notification(v_request.user_id, 'enrollment_approved',
    '{"en":"Enrollment Approved","ge":"ჩარიცხვა დამტკიცდა"}'::jsonb,
    ('{"en":"You have been enrolled in ' || v_course.title || '","ge":"თქვენ ჩაირიცხეთ ' || v_course.title || '-ში"}'::jsonb),
    jsonb_build_object('course_id', v_course.id, 'request_id', request_id));
END;
$$;
```

### 5. Update: approve_bundle_enrollment_request() RPC
**Change**: Same pattern — grant 1-month `project_access_expires_at` on FIRST enrollment (across all courses).

(Modify existing migration 062/080 pattern)

### 6. New RPCs: Subscription Management
```sql
CREATE OR REPLACE FUNCTION approve_project_subscription(subscription_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_sub project_subscriptions%ROWTYPE;
BEGIN
  IF NOT check_is_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE project_subscriptions
    SET status = 'active', starts_at = NOW(), expires_at = NOW() + INTERVAL '1 month',
        approved_by = auth.uid(), approved_at = NOW(), updated_at = NOW()
    WHERE id = subscription_id
    RETURNING * INTO v_sub;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found'; END IF;
  RETURN row_to_json(v_sub)::JSONB;
END;
$$;

CREATE OR REPLACE FUNCTION reject_project_subscription(subscription_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT check_is_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE project_subscriptions SET status = 'rejected', updated_at = NOW()
    WHERE id = subscription_id;
END;
$$;
```

---

## New Hooks (3 files)

### useProjectAccess(userId?: string)
**File**: `hooks/useProjectAccess.ts`

**Purpose**: Determine if user has active project access via enrollment or subscription.

**Returns**:
```typescript
{
  hasInitialAccess: boolean;      // profile.project_access_expires_at > now
  hasActiveSubscription: boolean; // subscription.status='active' && expires_at > now
  hasProjectAccess: boolean;      // hasInitialAccess || hasActiveSubscription
  subscription: project_subscriptions | null;
  isLoading: boolean;
}
```

**Implementation**:
- SWR 1: fetch `profiles.project_access_expires_at` from `GET /api/profile`
- SWR 2: fetch user's latest subscription from `GET /api/project-subscriptions`
- Realtime: subscribe to `project_subscriptions` table for userId → auto-refetch on changes

### useAdminProjectSubscriptions()
**File**: `hooks/useAdminProjectSubscriptions.ts`

**Purpose**: Admin dashboard data for subscription approval workflow.

**Returns**:
```typescript
{
  pending: project_subscriptions[],
  active: project_subscriptions[],
  rejected: project_subscriptions[],
  all: project_subscriptions[],
  isLoading: boolean,
  mutate: () => Promise<void>
}
```

**Implementation**:
- SWR: `GET /api/admin/project-subscriptions`
- Realtime: postgres_changes on `project_subscriptions` table
- Auto-filter into pending/active/rejected

### useRealtimeBundleEnrollmentRequests()
**File**: `hooks/useRealtimeBundleEnrollmentRequests.ts`

**Purpose**: Real-time notifications when bundle enrollment requests are approved/rejected.

**Returns**:
```typescript
{
  pendingRequests: bundle_enrollment_requests[],
  isLoading: boolean,
  onApproved: (callback: (bundleId: string) => void) => () => void,
  onRejected: (callback: (bundleId: string) => void) => () => void
}
```

**Implementation**: Mirror of `useRealtimeEnrollmentRequests` but for `bundle_enrollment_requests` table.

---

## New Components (2 files)

### ProjectSubscriptionModal.tsx
**File**: `components/ProjectSubscriptionModal.tsx`

**Purpose**: 4-view modal for student subscription purchase workflow.

**Props**:
```typescript
interface ProjectSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  courseId?: string; // for context
}
```

**Views**:
1. **Status View** (if user has pending/active/rejected subscription):
   - Show badge: "Pending Approval" | "Active until [date]" | "Rejected"
   - If rejected: show date and option to submit new request

2. **Payment View** (default):
   - Price: "₾10.00 per month"
   - Bank account: "GE00BG0000000013231" with copy button
   - Reference code: 5-char unique code (e.g., hash of userId)
   - Screenshot upload: drag-drop or click → upload to `payment-screenshots` bucket
   - Submit button: disabled until screenshot uploaded
   - On submit: `POST /api/project-subscriptions` + toast success + close modal

3. **Loading**: While submit is in progress
4. **Error**: If upload fails or API error

**UI**: Reuse `EnrollmentWizard` patterns (step-by-step cards, upload component, payment instructions).

### ProjectCard.tsx Updates
**File**: `components/chat/ProjectCard.tsx`

**Props Addition**:
```typescript
interface ProjectCardProps {
  // ... existing props ...
  courseId: string;           // NEW
  isEnrolledInCourse: boolean; // NEW - replaces isEnrollmentExpired
}
```

**Logic Changes**:
```typescript
const { hasProjectAccess } = useProjectAccess(currentUserId);

const canSubmit =
  !isLecturer
  && !isProjectOwner
  && !isProjectExpired
  && hasProjectStarted
  && hasBudgetAvailable
  && (
    (isEnrolledInCourse && hasProjectAccess)
    || (!isEnrolledInCourse && hasProjectAccess)  // subscription suffices
  );

// If not enrolled but no active subscription: show lock icon
const showLockIcon = !isEnrolledInCourse && !hasProjectAccess;
```

When `showLockIcon`: click → open `ProjectSubscriptionModal`.

---

## New API Routes (4 files)

### GET /api/project-subscriptions
**File**: `app/api/project-subscriptions/route.ts`

**Method**: GET

**Auth**: User token

**Returns**:
```json
{
  "subscriptions": [
    {
      "id": "uuid",
      "status": "pending|active|expired|rejected",
      "created_at": "ISO-8601",
      "approved_at": "ISO-8601 or null",
      "expires_at": "ISO-8601 or null"
    }
  ]
}
```

**Query**: Order by `created_at DESC`, limit to user's own.

### POST /api/project-subscriptions
**File**: `app/api/project-subscriptions/route.ts`

**Method**: POST

**Auth**: User token

**Body**:
```json
{
  "payment_screenshot": "https://..."
}
```

**Validation**:
- User must not have existing `pending` subscription
- `payment_screenshot` must be valid URL
- User must be authenticated (not lecturer/admin in some configurations)

**Action**:
- INSERT `{ user_id, payment_screenshot, price: 10.00, status: 'pending', created_at: NOW() }`
- Return 201 + subscription object

**Error Cases**:
- 400: Pending request already exists
- 401: Unauthorized
- 422: Invalid screenshot URL

### POST /api/admin/project-subscriptions/[id]/approve
**File**: `app/api/admin/project-subscriptions/[id]/approve/route.ts`

**Method**: POST

**Auth**: Admin token (check via `check_is_admin` RPC)

**Action**:
- Call `approve_project_subscription(id)` RPC
- Create in-app notification: "Project Subscription Approved" (bilingual)
- Return 200 + updated subscription

**Error Cases**:
- 401: Not admin
- 404: Subscription not found
- 500: RPC failure

### POST /api/admin/project-subscriptions/[id]/reject
**File**: `app/api/admin/project-subscriptions/[id]/reject/route.ts`

**Method**: POST

**Auth**: Admin token

**Action**:
- Call `reject_project_subscription(id)` RPC
- Create in-app notification: "Project Subscription Rejected" (bilingual)
- Return 200

**Error Cases**: Same as approve.

### GET /api/admin/project-subscriptions
**File**: `app/api/admin/project-subscriptions/route.ts`

**Method**: GET

**Auth**: Admin token

**Returns**: All subscriptions joined with `profiles` (username, avatar_url) + status counts.

```json
{
  "subscriptions": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "username": "BejeXa",
      "avatar_url": "https://...",
      "price": 10.00,
      "status": "pending",
      "created_at": "ISO-8601",
      "payment_screenshot": "https://..."
    }
  ],
  "counts": {
    "pending": 5,
    "active": 12,
    "rejected": 2
  }
}
```

---

## Page Updates (2 files)

### app/courses/[courseId]/chat/page.tsx

**Gate Logic**:
```typescript
const { hasActiveSubscription } = useProjectAccess(user?.id);

// Allow access if: enrolled OR (admin/lecturer) OR (has active subscription)
if (
  userRole !== 'admin'
  && userRole !== 'lecturer'
  && !isEnrolled
  && !hasActiveSubscription
) {
  setError('not_enrolled_and_no_subscription');
  return <CourseAccessDenied />;
}
```

**Channel Visibility**:
```typescript
// Subscribed non-enrolled users see only projects channel
const visibleChannels = isEnrolled
  ? sortedChannels
  : sortedChannels.filter(ch => ch.name === 'projects');
```

### app/admin/page.tsx

**New Section**: "Project Subscriptions"

**Content**:
- Real-time pending count badge (e.g., "5 Pending")
- Tabs: Pending | Active | Rejected
- For each subscription card:
  - Username, created_at date, price, screenshot thumbnail (clickable → full screenshot modal)
  - Status badge
  - Approve / Reject buttons
  - On action: optimistic update + refetch

**Implementation**: Reuse admin card pattern from existing enrollment requests section.

---

## Bug Fixes (3 files)

### 1. EnrollmentWizard.tsx — Async Validation Bypass

**Location**: Line 283 (approx.)

**Problem**: `validateStep(4)` is async but not awaited. Form submits even if validation fails.

**Fix**:
```typescript
// BEFORE
if (!validateStep(4)) {
  return;
}

// AFTER
const isValid = await validateStep(4);
if (!isValid) {
  return;
}
```

### 2. SubmissionReviewDialog.tsx — Missing Rejection Flow

**Location**: `components/chat/SubmissionReviewDialog.tsx`

**Problem**: Dialog only allows acceptance; no rejection workflow.

**Fix**:
1. Add toggle/radio: "Accept" | "Reject"
2. Show rejection reason textarea when "Reject" selected
3. Modify submission upsert to pass `{ status: 'accepted'|'rejected', rejection_reason: '...' }`
4. Return rejection message in toast

### 3. CourseEnrollmentCard.tsx + useRealtimeBundleEnrollmentRequests — Realtime Notifications

**Problem**: Bundle enrollment request approvals/rejections not notifying user in real-time.

**Fix**:
1. Wire `useRealtimeBundleEnrollmentRequests` in `app/courses/page.tsx`
2. Show toast on approval/rejection
3. Add "Pending" badge to bundle cards when user has pending request

---

## Component Prop Updates

### Message.tsx
**Change**: Pass `courseId` and `isEnrolledInCourse` to `<ProjectCard />`.

**Before**:
```typescript
<ProjectCard {...projectProps} />
```

**After**:
```typescript
<ProjectCard
  {...projectProps}
  courseId={courseId}
  isEnrolledInCourse={isEnrolled}
/>
```

---

## Access Matrix (From PROJECTS.md)

| User Type | Enrolled + Access | Enrolled + Expired | Subscribed Only | Not Enrolled |
|---|---|---|---|---|
| Student | ✅ See all projects, can submit | ❌ Cannot submit (expired) | ✅ Can submit to projects | ❌ No access |
| Student (after 1mo) | ✅ Can still submit (lifetime) | — | — | — |
| Lecturer | ✅ See all, no budget | — | — | — |
| Admin | ✅ See all, full control | — | — | — |

---

## Deployment Checklist

- [ ] Create migration 099 with all schema + RPC changes
- [ ] Deploy to staging Supabase (bvptqdmhuumjbyfnjxdt)
- [ ] Verify backfill: `SELECT COUNT(*) FROM enrollments WHERE expires_at IS NOT NULL` should be 0
- [ ] Verify project_subscriptions table exists + has RLS
- [ ] Create all 6 new files (hooks, components, API routes)
- [ ] Update 2 page files (courses/chat, admin)
- [ ] Update 1 component (ProjectCard.tsx, Message.tsx)
- [ ] Deploy to DigitalOcean staging
- [ ] Test: First enrollment grants project_access_expires_at
- [ ] Test: Subscription purchase + admin approval workflow
- [ ] Test: Non-enrolled but subscribed user can access projects channel
- [ ] Test: EnrollmentWizard async validation fix
- [ ] Test: Submission rejection flow
- [ ] Test: Bundle enrollment realtime toast
- [ ] Create PR: `staging` → `main` (no force push)

---

## Risk Assessment

**High Risk**:
- ❌ Backfilling `expires_at` to NULL changes enrollment model → test thoroughly
- ❌ New table + RLS could block admin access if policies misconfigured

**Medium Risk**:
- ⚠️ ProjectCard.tsx prop change affects all project displays
- ⚠️ Budget calculation must not count subscriptions as enrollments

**Low Risk**:
- ✅ New API routes are isolated
- ✅ Bug fixes are surgical (no DB changes)

---

## Known Unknowns / Open Questions

1. **Budget calculation**: Should subscription users have the same budget as enrolled users? (Assume: yes, same ₾ budget per project.)
2. **Referrals**: Can subscriptions have referral codes? (Assume: no, only courses have referrals.)
3. **Auto-renewal**: After 1 month, does subscription auto-renew or require manual re-submission? (Assume: manual re-submission required.)

---

## Status Log

- **2026-02-28**: Initial spec written. Ready for step-by-step implementation.

