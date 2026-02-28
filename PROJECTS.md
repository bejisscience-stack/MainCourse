# Projects — Complete Flow Documentation

## What Projects Are

Projects are **paid work assignments** posted inside a course's "Projects" channel by a lecturer. Each project has a budget, date range, platform targets, and evaluation criteria (with a Rate Per Match = RPM value each). Students submit video links; lecturers review and approve/reject based on matched criteria. Approved submissions pay out from the project budget.

**Architectural note**: Every project is also a chat message. `projects.message_id` FK → `messages(id)`. The `Message` component detects project messages and renders a `ProjectCard` instead of plain text.

## Database Tables

| Table | Key Columns | Purpose |
|---|---|---|
| `projects` | `id, message_id, course_id, user_id (lecturer), name, description, budget, min_views, max_views, platforms[], start_date, end_date` | Project definition |
| `project_criteria` | `id, project_id, criteria_text, rpm, display_order, platform` | Per-platform or all-platform evaluation criteria |
| `project_submissions` | `id, project_id, message_id, user_id, platform_links (JSONB), message` | Student video submissions |
| `submission_reviews` | `id, submission_id, project_id, lecturer_id, status (pending/accepted/rejected), matched_criteria_ids[], payment_amount, platform` | Lecturer reviews per platform |

## Projects Channel Auto-Creation

When a course is created, a DB trigger `on_course_created_create_channels` automatically creates two channels:
- `lectures` channel (type: text)
- `projects` channel (type: text)

Students get access to the projects channel as part of course enrollment — no separate activation needed.

## Who Can See & Submit to Projects

### Viewing Projects

**Public (no auth required)**:
- Active projects (current date between `start_date` and `end_date`) are visible on `/projects` page and homepage carousel
- Policy: `"Anyone can view active projects"` (migration 076)
- `ProjectCard.tsx` and `ActiveProjectsCarousel.tsx` components for public display
- `ProjectDetailsModal.tsx` shows full details + CTA: "Enroll" (if not enrolled) or "Go to Project" (if enrolled)

**Inside course chat (viewing)**:
- All logged-in users can view all projects (enrolled or not)
- Students see active projects only (expired projects hidden from students in `Message.tsx`)
- Lecturers see all projects including expired ones (shown with "EXPIRED" badge)

### Submitting to Projects

**Submission gating** is controlled by project access, NOT course enrollment alone:

| Condition | Can Submit | Details |
|---|---|---|
| Not enrolled in course + no project access | ❌ Lock icon | Cannot navigate to course chat anyway |
| Enrolled + within 1-month initial access | ✅ | Can submit to this course's projects only |
| Enrolled + initial access expired + no subscription | ❌ Lock icon | "Access expired. Buy subscription to continue." |
| Active project subscription (₾10/month) | ✅ | Can submit to ANY project on the platform (all lecturers, all courses) |
| Not enrolled + active subscription | ✅ (in projects channel only) | Can access course's projects channel even if not enrolled; sees ONLY projects channel |
| Lecturer (course owner) | ✅ | Can create and review projects |
| Admin | ✅ | All access |

## Project Creation Flow (Lecturer)

```
Lecturer is in /courses/[courseId]/chat on the Projects channel
  → Sees "+" button (isProjectsChannel && isLecturer guard in ChatArea.tsx)
  → Clicks → VideoUploadDialog opens (multi-step form)

VideoUploadDialog — 4 Steps:
  1. Video: optional reference video link for the project
  2. Budget: total budget (DECIMAL), min_views, max_views, platforms[] (multi-select)
  3. Details: project name, description, start_date, end_date
  4. Criteria: add criteria items (text + RPM per platform or all-platforms)

On Submit:
  1. POST message to channel via supabase/functions/chat-messages edge function
     → Creates messages row with content = "🎬 Project: {name}"
  2. INSERT into projects table with the returned message_id
  3. INSERT into project_criteria rows (one per criterion)

Project appears as a ProjectCard in the channel chat for all enrolled students
```

## Student Submission Flow

### With Access

```
Student sees ProjectCard in the Projects channel
  → Checks canSubmit:
      !isLecturer
      && !isProjectOwner
      && !isProjectExpired (end_date >= today)
      && hasProjectStarted (start_date <= today)
      && hasBudgetAvailable (totalSpent < budget)
      && hasProjectAccess (initial access OR subscription valid)
      && !alreadySubmittedThisPlatform (per platform)

Student clicks "Submit" → VideoSubmissionDialog opens
  → Selects platforms they're submitting for
  → Enters video URL per platform
  → Optionally adds a message (visible to lecturer only)

On Submit:
  1. POST reply message to channel (content: "Submission")
  2. INSERT into project_submissions:
     { project_id, message_id, user_id, platform_links: { youtube: url, ... }, message }

ProjectCard updates in real-time showing the submission
```

### Without Access (Lock Icon)

```
Student sees ProjectCard with lock icon (instead of submit button)
  → hasProjectAccess = false (no initial access + no active subscription)
  → Tooltip shows reason: "Access expired" or "Buy subscription"

Student clicks lock icon → ProjectSubscriptionModal opens

ProjectSubscriptionModal flow:
  1. Check if user has pending/active/rejected subscription
     - If active: show "Your subscription is active until [date]"
     - If pending: show "Your subscription request is under review"
     - If rejected: show "Previous request rejected. Try again below"
     - If none: show "Buy project subscription"

  2. Show subscription details:
     - Price: ₾10.00 / month (auto-renews)
     - Duration: 1 month from approval
     - Includes: submit to any project on platform

  3. Payment section (similar to EnrollmentWizard step 2):
     - Bank account: GE00BG0000000013231
     - Unique reference code (5-char hash of user_id or subscription_id)
     - Copy-to-clipboard UI

  4. Screenshot upload section:
     - Upload payment screenshot to Supabase Storage 'payment-screenshots' bucket
     - Similar to course enrollment screenshot upload
     - Validate: PNG/JPG only, max 5MB

  5. Review + Submit button
     - POST /api/project-subscriptions
     - Validates: no other pending request exists
     - Creates row: { user_id, status='pending', price=10.00, payment_screenshot, created_at }
     - Toast: "Subscription request submitted for admin review"
     - Modal closes, ProjectCard shows lock icon with "Pending review" tooltip

Realtime update (when admin approves):
  → useProjectAccess hook refetches subscription
  → ProjectCard re-renders, lock icon disappears, submit button appears
  → Toast: "Your project subscription was approved!"
```

## Lecturer Review Flow

```
Lecturer sees submission in ProjectCard
  → Clicks "Review" → SubmissionReviewDialog opens
  → Selects platform being reviewed
  → Views student's video URL for that platform
  → Checks matching criteria (criteria_text items with RPM values)
  → payment_amount auto-calculated: sum of RPMs for checked criteria
  → Writes optional comment
  → Selects status: 'accepted' or 'rejected'

On Submit:
  → UPSERT into submission_reviews:
     { submission_id, project_id, lecturer_id, status, matched_criteria_ids[], payment_amount, platform }
  → Unique constraint: one review per (submission_id, platform)
  → If accepted: payment_amount is credited to student (balance_transactions)
  → Budget is decremented in real-time via useProjectBudget hook
```

## Admin Subscription Approval Flow

```
Admin navigates to /admin dashboard
  → New section: "Project Subscriptions"
  → Shows list of pending requests:
      - Username (linked to profile)
      - Request date
      - Price: ₾10.00
      - Payment screenshot (clickable/expandable)
      - Status badge: "pending"

Admin reviews screenshot, verifies bank transfer
  → Clicks "Approve" button
     - POST /api/admin/project-subscriptions/[id]/approve
     - Calls RPC: approve_project_subscription(subscription_id)
     - Sets: status='active', starts_at=NOW(), expires_at=NOW() + 1 month, approved_by=admin_id
     - Returns: updated subscription record
     - Realtime triggers update in user's subscription query
     - Student gets toast: "Your project subscription was approved!"

OR

  → Clicks "Reject" button
     - POST /api/admin/project-subscriptions/[id]/reject
     - Calls RPC: reject_project_subscription(subscription_id)
     - Sets: status='rejected'
     - Student gets toast: "Your subscription request was rejected. Please try again."
     - Lock icon reappears with "Request rejected" tooltip
```

## Access Duration for Projects

Project submission access is determined by:
1. **Course enrollment status** (for enrolled-course submissions), OR
2. **Project subscription status** (for any-course submissions)

### Initial Access (First Enrollment)

When a student enrolls in their first course:
- Automatic grant: `profiles.project_access_expires_at = NOW() + 1 month`
- This 1-month window allows submissions **in that enrolled course only**
- After 1 month expires: must purchase subscription to continue
- This is a **one-time benefit** per user (applies to first enrollment forever)

### Project Subscription

After initial 1-month access expires (or if never enrolled):
- Student must purchase monthly subscription (₾10 GEL/month)
- Payment flow: same as course enrollment (bank transfer + screenshot)
- Admin approval: status = 'active', starts_at = NOW(), expires_at = NOW() + 1 month
- Active subscription allows submissions to **any project on the platform** (all lecturers, all courses)
- Upon expiry: lock icons return, cycle repeats

### canSubmit Logic (ProjectCard Component)

```ts
const { hasInitialAccess, hasActiveSubscription, hasProjectAccess } = useProjectAccess(userId);
const isEnrolledInCourse = enrolledCourseIds.has(courseId);

const canSubmit =
  !isLecturer
  && !isProjectOwner
  && !isProjectExpired            // projects.end_date >= today
  && hasProjectStarted            // projects.start_date <= today
  && hasBudgetAvailable           // remaining budget > 0
  && (
    // Enrolled course: need initial access OR subscription
    (isEnrolledInCourse && hasProjectAccess)
    ||
    // Non-enrolled course: need active subscription only
    (!isEnrolledInCourse && hasActiveSubscription)
  );
```

**When `!canSubmit` due to access (not budget/deadline/ownership)**:
- Show lock icon instead of submit button
- On click → open `ProjectSubscriptionModal`
- Tooltip: "Buy project subscription" (if never had access) or "Access expired" (if expired)

### Project-level Expiry (Deadline)

Separate from user access; gated by `projects.end_date`:
- After `end_date`: project is "expired" from the project's own perspective
  - Students: project card hidden entirely (`if (projectCountdown.isExpired && !isLecturer) return null`)
  - Lecturers: project card shown with "EXPIRED" badge, no submissions possible
- Before `projects.start_date`: project not yet open
  - `canSubmit` requires `hasProjectStarted = start_date <= today`

## Budget System

```
project.budget                      = total available budget
SUM(submission_reviews.payment_amount WHERE status='accepted')  = totalSpent
Remaining = budget - totalSpent

useProjectBudget hook:
  → Queries submission_reviews for the project WHERE status='accepted'
  → Sums payment_amount
  → Real-time updates via useRealtimeSubmissionReviews

Display:
  → Progress bar: totalSpent / budget (%)
  → "Remaining: ₾X.XX" shown on ProjectCard
  → hasBudgetAvailable = remainingBudget > 0 (gates submission)
```

## Public Projects Discovery → Enrollment Funnel

```
Homepage or /projects page
  → ActiveProjectsCarousel / ProjectCard shown for all active projects
  → Anyone can view: title, budget, platforms, criteria, countdown

User clicks "View Details" → ProjectDetailsModal
  → Full project info
  → If user not enrolled:
      CTA: "Enroll in Course" → opens EnrollmentWizard for that course
  → If user enrolled:
      CTA: "Go to Project" → navigates to /courses/[courseId]/chat
  → If not logged in:
      CTA: "Sign In to Enroll" → redirect to /signin with pendingEnroll param
```

## Real-time Updates

All project data updates in real-time via Supabase Realtime subscriptions:

| Hook | Listens to | Effect |
|---|---|---|
| `useRealtimeProjects` | `projects` table | New/updated projects appear instantly |
| `useRealtimeProjectCriteria` | `project_criteria` | Criteria changes reflected immediately |
| `useRealtimeSubmissionReviews` | `submission_reviews` WHERE project_id | Budget recalculated, review status shown |
| `useActiveProjects` | `projects` (active filter) | Public page stays current |

## Key Files

| File | Role |
|---|---|
| `app/projects/page.tsx` | Public projects listing (active only) |
| `components/ProjectCard.tsx` | Public project card (homepage, /projects) |
| `components/ProjectDetailsModal.tsx` | Public project detail + enroll/go-to CTA |
| `components/ActiveProjectsCarousel.tsx` | Homepage active projects carousel |
| `components/ProjectSubscriptionModal.tsx` | Subscription purchase flow (payment + screenshot upload) |
| `components/chat/ProjectCard.tsx` | In-channel project card (submissions, budget, review, lock icon) |
| `components/chat/VideoUploadDialog.tsx` | Lecturer: create project (4-step form) |
| `components/chat/VideoSubmissionDialog.tsx` | Student: submit video per platform |
| `components/chat/SubmissionReviewDialog.tsx` | Lecturer: review submission, match criteria, set payment |
| `components/chat/Message.tsx` | Detects project messages → renders ProjectCard |
| `components/chat/ChatArea.tsx` | "+" button (lecturers only, Projects channel only) |
| `hooks/useActiveProjects.ts` | Fetches active projects with criteria + lecturer info |
| `hooks/useProjectBudget.ts` | Real-time budget computation from accepted reviews |
| `hooks/useProjectCountdown.ts` | Countdown timer to project end_date |
| `hooks/useRealtimeProjects.ts` | Realtime subs for projects, criteria, reviews |
| `hooks/useProjectAccess.ts` | Queries project_access_expires_at + active subscriptions → hasProjectAccess |
| `hooks/useAdminProjectSubscriptions.ts` | Admin: pending/approved/rejected subscriptions + realtime |
| `app/api/project-subscriptions/route.ts` | Create/fetch user's project subscription requests |
| `app/api/admin/project-subscriptions/[id]/approve/route.ts` | Admin approval → approve_project_subscription RPC |
| `app/api/admin/project-subscriptions/[id]/reject/route.ts` | Admin rejection → reject_project_subscription RPC |
| `app/api/admin/analytics/projects/route.ts` | Admin analytics: project stats, budgets, platforms |
| `supabase/migrations/099_project_subscription_system.sql` | DB changes: tables, RLS, RPCs |
