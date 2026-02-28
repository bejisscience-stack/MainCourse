# Courses — Complete Flow Documentation

## Database Tables

| Table | Key Columns | Purpose |
|---|---|---|
| `courses` | `id, title, price, original_price, course_type, lecturer_id, referral_commission_percentage` | Master course catalog |
| `enrollment_requests` | `id, user_id, course_id, status (pending/approved/rejected), payment_screenshots, referral_code` | Pending payment verifications |
| `enrollments` | `id, user_id, course_id, approved_at` | Lifetime course access |
| `course_bundles` | `id, lecturer_id, title, price, is_active` | Grouped course bundles |
| `course_bundle_items` | `bundle_id, course_id` | Many-to-many: courses in a bundle |
| `bundle_enrollment_requests` | `user_id, bundle_id, status, payment_screenshots` | Bundle payment requests |
| `bundle_enrollments` | `user_id, bundle_id` | Bundle-level enrollment tracker |
| `referrals` | `referrer_id, referred_user_id, referral_code, enrollment_request_id, course_id` | Referral tracking for commissions |

## Who Can See Courses

- **Anonymous**: Can view the public `/courses` listing (SELECT RLS policy is public)
- **Students**: See all courses + their enrolled courses section
- **Lecturers**: Can see courses but are redirected to `/lecturer/dashboard` on course chat access
- **Admins**: Full access, bypass all enrollment and expiry checks

## Single-Course Enrollment Flow

```
Step 1: User browses /courses page
  → Public listing, no auth required to view
  → URL params supported: ?course=ID&ref=REFERRAL_CODE → auto-opens enrollment wizard
  → URL params supported: ?pendingEnroll=course:ID → post-login redirect

Step 2: User clicks "Request Enrollment" on a CourseCard
  → CourseEnrollmentCard.tsx checks enrollment status:
      - Already enrolled → "Go to Course" button
      - Pending request  → "Pending" button (disabled)
      - Not enrolled     → "Request Enrollment" button
  → Opens EnrollmentWizard (full-screen 5-step modal)
  → No re-enrollment option (one-time purchase grants lifetime access)

Step 3: EnrollmentWizard — 5 Steps
  1. Course Overview: title, price, description
  2. Payment: Bank account GE00BG0000000013231 + unique 5-char course code (hash of courseId)
     → User must transfer the course price to this account using the code as the reference
  3. Referral Code: optional — validated against /api/validate-referral-code
  4. Screenshot Upload: upload payment screenshot(s) to Supabase Storage 'payment-screenshots' bucket
  5. Review + Submit
  → LocalStorage backup preserves form state on accidental close

Step 4: Submission
  → POST /api/enrollment-requests
  → Payload: { courseId, paymentScreenshots: [...urls], referralCode }
  → Creates row in enrollment_requests with status = 'pending'
  → Calls process_referral RPC (or process_signup_referral_on_enrollment as fallback)
  → No re-enrollment logic (one-time purchase)

Step 5: Admin Review
  → Admin sees request in /admin dashboard (useAdminEnrollmentRequests hook)
  → Admin views payment screenshots, verifies bank transfer manually
  → Admin clicks Approve → POST /api/admin/enrollment-requests/[id]/approve
  OR
  → Admin clicks Reject → POST /api/admin/enrollment-requests/[id]/reject

Step 6: Approval — DB Function approve_enrollment_request(request_id)
  → Verifies caller is admin via check_is_admin(auth.uid())
  → Looks up: course price, referral_commission_percentage, lecturer_id
  → Commission distribution:
      If referral code valid + commission > 0:
        Referrer gets: commission% × price  → credited via credit_user_balance()
        Lecturer gets: price - commission   → credited via credit_user_balance()
      Else:
        Lecturer gets 100% of price
  → Sets enrollment_requests.status = 'approved'
  → INSERT into enrollments:
      { user_id, course_id, approved_at = NOW() }
      (No expires_at — lifetime access)
  → Calls create_notification RPC → in-app notification for student
  → Calls sendEnrollmentApprovedEmail → email to student

Step 7: Real-time Update
  → useRealtimeEnrollmentRequests hook (Supabase Realtime) fires on enrollment_requests table change
  → Toast notification shown to the student immediately
  → useEnrollments refreshes → "Go to Course" button appears
  → Student has lifetime access to /courses/[courseId]/chat
```

## Bundle Enrollment Flow

Same as single-course but:
- `BundleEnrollmentModal` component (not EnrollmentWizard)
- POST to `/api/bundle-enrollment-requests`
- Admin approves via `approve_bundle_enrollment_request(request_id)` DB function
- This creates individual `enrollments` rows for **every course in the bundle**, each with lifetime access (no expiry)
- Also creates a `bundle_enrollments` row at the bundle level

## Access Duration

- **All enrollments grant lifetime access** from admin approval timestamp
- No expiry: after one-time purchase, student has permanent access to the course
- Column: `enrollments.approved_at TIMESTAMPTZ` tracks when access was granted
- Client-side check in `hooks/useEnrollments.ts`:
  ```ts
  isActive = enrolled  // No expiry check needed
  ```
- Admins always have access — no enrollment check needed

## Course Chat Access Control

| Condition | Result |
|---|---|
| Not logged in | Redirect to /signin |
| Logged in, not enrolled | Redirect to /courses with enroll prompt |
| Enrolled (lifetime access) | Full access to chat |
| Lecturer (course owner) | Redirect to /lecturer/chat |
| Admin | Full access |

## Project Access & Subscription

**Project submission** is gated separately from course enrollment. All users can **view** projects, but **submission** requires either:
1. Initial 1-month project access (automatic with first enrollment), OR
2. Active monthly project subscription (₾10 GEL/month, manual purchase)

### Database Changes for Project Access

**New columns on `profiles` table:**
```sql
project_access_expires_at TIMESTAMPTZ NULL
  -- NULL = never had initial access (never enrolled)
  -- Set to NOW() + 1 month on FIRST-EVER enrollment approval
  -- Never updated again; subscription is handled separately
```

**New table: `project_subscriptions`**
```sql
CREATE TABLE public.project_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  price DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  payment_screenshot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'expired', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: users can view/create own, admins manage via RPC
-- Realtime enabled for instant updates
```

### Project Access Flow

```
Step 1: User enrolls in ANY course (single or bundle)
  → If user has NEVER enrolled before:
      Enrollment approval sets: profiles.project_access_expires_at = NOW() + 1 month
  → User gets 1 month to submit to projects in their enrolled courses only
  → This is a one-time benefit; never expires again until subscription

Step 2: User's initial access expires (after 1 month)
  → All ProjectCards in chat show lock icon
  → ProjectCard.canSubmit = false
  → Click lock icon → ProjectSubscriptionModal opens

Step 3: User purchases project subscription (₾10/month)
  → ProjectSubscriptionModal shown:
      - Current subscription status (if any)
      - Price: ₾10.00 / month
      - Bank account: same as course enrollment
      - Unique reference code (similar to course code)
      - Screenshot upload to Supabase Storage 'payment-screenshots' bucket
  → POST /api/project-subscriptions
  → Creates row with status = 'pending'
  → Toast: "Subscription request submitted for admin review"

Step 4: Admin review
  → In /admin dashboard: new "Project Subscriptions" section
  → Lists pending subscription requests (status = 'pending')
  → Shows: username, payment screenshot, date, price
  → Approve button → POST /api/admin/project-subscriptions/[id]/approve
     - Sets status = 'active'
     - Sets starts_at = NOW()
     - Sets expires_at = NOW() + 1 month
     - Realtime triggers student toast: "Subscription approved!"
  → Reject button → POST /api/admin/project-subscriptions/[id]/reject
     - Sets status = 'rejected'

Step 5: Subscription active
  → useProjectAccess hook returns:
      hasInitialAccess: false (expired)
      hasActiveSubscription: true
      hasProjectAccess: true (derived: hasInitialAccess OR hasActiveSubscription)
  → Student can submit to ANY project (all courses, all lecturers)
  → If subscribed but not enrolled: can navigate to any course's projects channel
    - Sees ONLY the projects channel (no lectures/chat)

Step 6: Subscription expires
  → expires_at < NOW() → status auto-updates to 'expired' (client-side)
  → Lock icons return on all ProjectCards
  → Cycle repeats: can purchase new subscription
```

### Access Matrix for Projects

| User State | Can View Projects | Can Submit to Projects |
|---|---|---|
| Not logged in | ✅ Public active only | ❌ |
| Logged in, never enrolled | ✅ All projects (browse) | ❌ |
| **Enrolled, within 1-month initial access** | ✅ All projects | ✅ **Enrolled courses only** |
| Enrolled, initial access expired, no subscription | ✅ All projects | ❌ Lock icon shown |
| **Active subscription (₾10/month)** | ✅ All projects | ✅ **ALL projects** (all courses, all lecturers) |
| Admin | ✅ All | ✅ All |
| Lecturer | ✅ All | Creates projects, reviews submissions |

### Subscribe-to-Non-Enrolled Course Access

When a subscribed user navigates to `/courses/[courseId]/chat`:
```ts
const isEnrolled = enrolledCourseIds.has(courseId);
const { hasActiveSubscription } = useProjectAccess(user?.id);

// Gate: allowed if enrolled OR (subscribed AND not lecturer)
if (userRole !== 'admin' && !isEnrolled && !hasActiveSubscription) {
  setError('not enrolled');
  return;
}

// If subscribed but not enrolled: show ONLY projects channel
const visibleChannels = isEnrolled
  ? allChannels  // Show lectures + projects
  : allChannels.filter(ch => ch.type === 'text' && ch.name === 'projects');
  // Show projects channel only
```

### Key Files

| File | Role |
|---|---|
| `app/courses/page.tsx` | Public course listing, filter, search, enrolled section |
| `app/my-courses/page.tsx` | Student enrolled courses dashboard |
| `app/courses/[courseId]/chat/page.tsx` | Course access page, expiry check, enrollment redirect, subscription gate |
| `components/CourseEnrollmentCard.tsx` | Smart button: request/pending/enrolled/expired states |
| `components/EnrollmentWizard.tsx` | 5-step enrollment modal |
| `components/enrollment/EnrollmentStepPayment.tsx` | Bank account display + course code generation |
| `components/BundleEnrollmentModal.tsx` | Bundle enrollment modal |
| `components/ProjectSubscriptionModal.tsx` | Subscription purchase flow (payment + screenshot upload) |
| `hooks/useEnrollments.ts` | Enrollment data + isExpired/daysRemaining computation |
| `hooks/useEnrollmentRequests.ts` | User's pending enrollment requests |
| `hooks/useRealtimeEnrollmentRequests.ts` | Real-time status updates via Supabase Realtime |
| `hooks/useProjectAccess.ts` | Queries project_access_expires_at + active subscriptions → returns hasProjectAccess |
| `hooks/useAdminProjectSubscriptions.ts` | Admin: pending/approved/rejected subscriptions + realtime |
| `app/api/enrollment-requests/route.ts` | Create/fetch enrollment requests |
| `app/api/admin/enrollment-requests/[id]/approve/route.ts` | Admin approval → approve_enrollment_request RPC |
| `app/api/project-subscriptions/route.ts` | Create/fetch user's project subscription requests |
| `app/api/admin/project-subscriptions/[id]/approve/route.ts` | Admin approval → approve_project_subscription RPC |
| `app/api/admin/project-subscriptions/[id]/reject/route.ts` | Admin rejection → reject_project_subscription RPC |
| `supabase/functions/admin-enrollment-approve/index.ts` | Edge function equivalent of enrollment approval |
| `supabase/migrations/099_project_subscription_system.sql` | All DB changes: tables, RLS, RPCs |
