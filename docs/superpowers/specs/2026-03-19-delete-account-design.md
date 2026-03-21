# Delete Account Feature — Design Spec

**Date**: 2026-03-19
**Status**: Approved
**Scope**: Add account self-deletion for students in profile settings

## Overview

Allow students to permanently delete their accounts from the settings page. Lecturers and admins are blocked from self-deletion and must contact an admin.

## User Flow

1. User navigates to Settings page
2. Scrolls to "Delete Account" section at the bottom (red-themed, visually distinct)
3. Clicks "Delete Account" button
4. Modal appears with:
   - Warning text explaining the action is permanent
   - Text input requiring the user to type "Delete" (case-sensitive)
   - Confirm button (disabled until input matches "Delete")
   - Cancel button
5. On confirm:
   - Client sends `DELETE /api/account/delete` with Bearer token
   - Server validates, cleans up non-cascading rows, deletes auth user (cascades to profile + all child tables)
   - Client signs out and redirects to `/`
6. If user is a lecturer or admin: section shows a message directing them to contact admin instead

## Architecture

### API Route: `DELETE /api/account/delete`

**Auth**: `verifyTokenAndGetUser(token)` — standard pattern from `lib/supabase-server.ts`

**Logic**:

```
1. Extract + verify Bearer token
2. Fetch profile to check role
3. If role === 'lecturer' || role === 'admin' → return 403 { error: "role_cannot_delete" }
4. Create service role client via createServiceRoleClient()
5. Clean up non-cascading rows:
   - DELETE FROM keepz_payments WHERE user_id = userId
   - DELETE FROM payment_audit_log WHERE user_id = userId
6. Delete auth user: supabase.auth.admin.deleteUser(userId)
   (This cascades to profiles and all other tables with ON DELETE CASCADE)
7. Return 200 { success: true }
```

**Error handling**:

- 401: Missing/invalid token
- 403: Lecturer or admin role blocked
- 500: Database or auth deletion failure

**Service role requirement**: `auth.admin.deleteUser()` requires `SUPABASE_SERVICE_ROLE_KEY`. This key is already configured in the environment and used by `createServiceRoleClient()` in `lib/supabase-server.ts`.

### Cascade Behavior

Deleting the auth user cascades to all tables with `ON DELETE CASCADE` on `auth.users(id)`:

| Table                      | FK Column                     | Cascade |
| -------------------------- | ----------------------------- | ------- |
| profiles                   | id                            | CASCADE |
| notifications              | user_id                       | CASCADE |
| muted_users                | user_id                       | CASCADE |
| unread_messages            | user_id                       | CASCADE |
| video_progress             | user_id                       | CASCADE |
| project_submissions        | user_id                       | CASCADE |
| balance_transactions       | user_id                       | CASCADE |
| withdrawal_requests        | user_id                       | CASCADE |
| project_subscriptions      | user_id                       | CASCADE |
| referrals                  | referrer_id, referred_user_id | CASCADE |
| saved_cards                | user_id                       | CASCADE |
| view_scrape_results        | user_id                       | CASCADE |
| messages                   | user_id                       | CASCADE |
| enrollments                | user_id                       | CASCADE |
| enrollment_requests        | user_id                       | CASCADE |
| bundle_enrollment_requests | user_id                       | CASCADE |
| typing_indicators          | user_id                       | CASCADE |

**Tables WITHOUT cascade (handled explicitly in API route before auth deletion)**:

| Table             | FK Column | Default Behavior          | Fix                      |
| ----------------- | --------- | ------------------------- | ------------------------ |
| keepz_payments    | user_id   | NO ACTION (blocks delete) | Delete rows in API route |
| payment_audit_log | user_id   | NO ACTION (blocks delete) | Delete rows in API route |

**Tables with NO ACTION but low risk for student deletion**:

| Table               | FK Column     | Notes                                                    |
| ------------------- | ------------- | -------------------------------------------------------- |
| audit_log           | admin_user_id | Students never appear here                               |
| notifications       | created_by    | Students rarely create notifications for others          |
| withdrawal_requests | processed_by  | This references the admin who processed, not the student |

**Deletion order**: Explicit cleanup of non-cascading rows → Delete auth user (cascades to everything else including profiles).

### Storage Cleanup

Orphaned storage objects (avatars in `avatars` bucket, chat media in `chat-media` bucket) are accepted. These can be cleaned up by a periodic admin task if needed. Not blocking for v1.

### UI Changes: `app/settings/page.tsx`

Add a "Danger Zone" section after the password change section (after line ~1334):

- Red-bordered card with warning styling
- "Delete Account" heading
- Description text explaining permanence
- For lecturers/admins: show info message "Contact admin to delete your account" with no button
- For students: red "Delete Account" button that opens the confirmation modal

**Confirmation modal** (inline in settings page, no separate component):

- Backdrop overlay
- Warning icon + bold warning text
- Input field with placeholder "Type Delete to confirm"
- Cancel button (charcoal/neutral)
- Confirm button (red, disabled until input === "Delete")
- Loading state with spinner during API call

### Translations

**English** (`locales/en.json`):

```json
"settings.deleteAccount": "Delete Account",
"settings.deleteAccountWarning": "This action is permanent and cannot be undone. All your data, enrollments, and progress will be permanently deleted.",
"settings.typeDeleteToConfirm": "Type \"Delete\" to confirm",
"settings.deleteAccountConfirmButton": "Permanently Delete Account",
"settings.deleteAccountLecturerBlocked": "Lecturers and administrators cannot delete their accounts directly. Please contact an administrator.",
"settings.accountDeleted": "Your account has been deleted.",
"settings.deleteAccountError": "Failed to delete account. Please try again."
```

**Georgian** (`locales/ge.json`):

```json
"settings.deleteAccount": "ანგარიშის წაშლა",
"settings.deleteAccountWarning": "ეს მოქმედება შეუქცევადია. თქვენი ყველა მონაცემი, ჩარიცხვა და პროგრესი სამუდამოდ წაიშლება.",
"settings.typeDeleteToConfirm": "დაადასტურეთ აკრიფეთ \"Delete\"",
"settings.deleteAccountConfirmButton": "ანგარიშის სამუდამოდ წაშლა",
"settings.deleteAccountLecturerBlocked": "ლექტორებს და ადმინისტრატორებს არ შეუძლიათ ანგარიშის პირდაპირ წაშლა. გთხოვთ დაუკავშირდეთ ადმინისტრატორს.",
"settings.accountDeleted": "თქვენი ანგარიში წაიშალა.",
"settings.deleteAccountError": "ანგარიშის წაშლა ვერ მოხერხდა. გთხოვთ სცადოთ თავიდან."
```

## Edge Cases

| Case                                  | Handling                                                                |
| ------------------------------------- | ----------------------------------------------------------------------- |
| Lecturer/admin tries to delete        | 403 error, UI shows "contact admin" message                             |
| Pending withdrawal exists             | Allow deletion — withdrawal cascades, admin has audit trail             |
| Active enrollments                    | CASCADE handles cleanup                                                 |
| Double-click on confirm               | Button disabled + loading state after first click                       |
| keepz_payments exist                  | Explicitly deleted before auth user deletion                            |
| User already deleted (race condition) | auth.admin.deleteUser returns error — return 500, user sees error toast |
| Network error during deletion         | Client shows error toast, user can retry                                |

## Files Changed

| File                              | Action | Description                       |
| --------------------------------- | ------ | --------------------------------- |
| `app/api/account/delete/route.ts` | CREATE | DELETE endpoint with service role |
| `app/settings/page.tsx`           | MODIFY | Add danger zone section + modal   |
| `locales/en.json`                 | MODIFY | Add 7 translation keys            |
| `locales/ge.json`                 | MODIFY | Add 7 translation keys            |

## Security Considerations

- Server verifies token before any action — no unauthenticated deletion possible
- Service role key used only server-side, never exposed to client
- Role check prevents lecturers and admins from deleting (protects course integrity and platform stability)
- No confirmation email needed — typing "Delete" is sufficient friction for this platform's scale
- Audit trail: Supabase auth logs retain deletion events
