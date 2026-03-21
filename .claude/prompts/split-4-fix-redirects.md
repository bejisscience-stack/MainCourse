# Split 4: Fix Navigation Redirects

## Goal

Fix incorrect redirects throughout the app:

1. Payment success → should go to the purchased course, not `/my-courses`
2. Project subscription success → should go to the project's course chat with projects channel
3. "Go to Project" → should navigate to the correct channel within course chat

## Files to Modify

### 1. `app/payment/success/page.tsx`

**Current behavior (broken):**

- Course/bundle enrollment → `/my-courses`
- Project subscription → `/chat`

**Fix:**

- The payment status endpoint returns the payment record which includes `course_id`, `bundle_id`, and `payment_type`
- After successful payment:
  - `course_enrollment` → `/courses/{courseId}/chat` (go directly to the enrolled course's chat)
  - `bundle_enrollment` → `/my-courses` (bundle has multiple courses, so /my-courses is correct)
  - `project_subscription` → `/courses/{courseId}/chat` (go to the course that has the project)
  - `project_budget` → `/courses/{courseId}/chat` (lecturer goes to course chat after funding project)
- Read the payment status response carefully to extract `course_id` — it should be available in the `keepz_payments` record
- If `course_id` is not available in the response, update `app/api/payments/keepz/status/route.ts` to include it

### 2. `app/api/payments/keepz/status/route.ts`

- Ensure the status response includes `course_id` and `payment_type` so the success page can build the correct redirect URL
- If currently not returning these fields, add them to the response

### 3. `app/payment/failed/page.tsx`

**Current behavior:**

- Redirects to `/courses`

**Fix:**

- If `courseId` is available from the failed payment, redirect to `/courses/{courseId}` (back to the specific course) instead of generic `/courses`
- If not available, keep `/courses` as fallback

### 4. `components/ProjectDetailsModal.tsx`

**Current behavior:**

- "Go to Project" button → `router.push(/courses/${project.course_id}/chat)`
- User has to manually select the "projects" channel

**Fix:**

- Navigate to `/courses/${project.course_id}/chat?channel=projects` or similar
- Check how the chat page reads URL params and navigates to specific channels
- Look at `components/chat/ChannelSidebar.tsx` and the course chat page to understand how channel selection works via URL
- If URL-based channel selection isn't supported, the chat page needs to read a query param and auto-select the projects channel

### 5. Course chat page (likely `app/courses/[courseId]/chat/page.tsx` or similar)

- If it doesn't already support `?channel=projects` query param, add support
- On page load, if `channel=projects` param exists, auto-select the projects channel
- This enables deep-linking to specific channels

## DO NOT Touch

- `components/chat/MessageInput.tsx` or `Message.tsx` (Agent 1)
- `lib/keepz.ts` or payment creation/callback files (Agent 2)
- `components/VideoPlayer.tsx` (Agent 3)
- Any admin/balance/withdrawal/encryption files (Agent 5)
- `components/chat/ChatArea.tsx` message rendering logic
- `middleware.ts` authentication redirects

## Validation

1. Run `npm run build` — must pass with zero errors
2. Verify all router.push calls use correct paths
3. Verify the payment status API returns course_id
4. Commit with message: "fix: correct payment success and project navigation redirects"
5. Output DONE when build passes.
