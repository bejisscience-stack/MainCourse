# Delete Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow students to permanently delete their accounts from the settings page, with a typed "Delete" confirmation. Lecturers and admins are blocked.

**Architecture:** A single API route (`DELETE /api/account/delete`) uses service role to clean up non-cascading rows then delete the auth user (which cascades to profiles and all child tables). The settings page gets a danger zone section with an inline confirmation modal.

**Tech Stack:** Next.js 14 App Router, Supabase Auth Admin API, TypeScript, Tailwind CSS, i18n via `useI18n()`

**Spec:** `docs/superpowers/specs/2026-03-19-delete-account-design.md`

---

## File Structure

| File                              | Action | Responsibility                                                                         |
| --------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| `app/api/account/delete/route.ts` | CREATE | DELETE endpoint — verify token, check role, clean non-cascading rows, delete auth user |
| `app/settings/page.tsx`           | MODIFY | Add delete account state, handler, danger zone UI section, confirmation modal          |
| `locales/en.json`                 | MODIFY | Add 7 translation keys under `settings`                                                |
| `locales/ge.json`                 | MODIFY | Add 7 translation keys under `settings`                                                |

---

### Task 1: Add translation keys

**Files:**

- Modify: `locales/en.json:219` (before closing `}` of settings object)
- Modify: `locales/ge.json:219` (before closing `}` of settings object)

- [ ] **Step 1: Add English translation keys**

In `locales/en.json`, find the last key in the `"settings"` object (line 219: `"noEnrolledCourses": "..."`) and add a comma after it, then add:

```json
    "deleteAccount": "Delete Account",
    "deleteAccountWarning": "This action is permanent and cannot be undone. All your data, enrollments, and progress will be permanently deleted.",
    "typeDeleteToConfirm": "Type \"Delete\" to confirm",
    "deleteAccountConfirmButton": "Permanently Delete Account",
    "deleteAccountLecturerBlocked": "Lecturers and administrators cannot delete their accounts directly. Please contact an administrator.",
    "accountDeleted": "Your account has been deleted.",
    "deleteAccountError": "Failed to delete account. Please try again."
```

- [ ] **Step 2: Add Georgian translation keys**

In `locales/ge.json`, same position (line 219), add comma after last key then:

```json
    "deleteAccount": "ანგარიშის წაშლა",
    "deleteAccountWarning": "ეს მოქმედება შეუქცევადია. თქვენი ყველა მონაცემი, ჩარიცხვა და პროგრესი სამუდამოდ წაიშლება.",
    "typeDeleteToConfirm": "დაადასტურეთ აკრიფეთ \"Delete\"",
    "deleteAccountConfirmButton": "ანგარიშის სამუდამოდ წაშლა",
    "deleteAccountLecturerBlocked": "ლექტორებს და ადმინისტრატორებს არ შეუძლიათ ანგარიშის პირდაპირ წაშლა. გთხოვთ დაუკავშირდეთ ადმინისტრატორს.",
    "accountDeleted": "თქვენი ანგარიში წაიშალა.",
    "deleteAccountError": "ანგარიშის წაშლა ვერ მოხერხდა. გთხოვთ სცადოთ თავიდან."
```

- [ ] **Step 3: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('locales/en.json'))" && node -e "JSON.parse(require('fs').readFileSync('locales/ge.json'))" && echo "OK"`

Expected: `OK`

---

### Task 2: Create the DELETE API route

**Files:**

- Create: `app/api/account/delete/route.ts`

**Dependencies:** None. Uses existing `verifyTokenAndGetUser`, `getTokenFromHeader`, `createServiceRoleClient`, `createServerSupabaseClient` from `lib/supabase-server.ts` and `lib/admin-auth.ts`.

- [ ] **Step 1: Create the route file**

Create `app/api/account/delete/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  try {
    // 1. Verify auth token
    const token = getTokenFromHeader(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, error: userError } = await verifyTokenAndGetUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch profile to check role
    const supabase = createServerSupabaseClient(token);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("[DeleteAccount] Profile fetch error:", profileError);
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // 3. Block lecturers and admins
    if (profile.role === "lecturer" || profile.role === "admin") {
      return NextResponse.json(
        { error: "role_cannot_delete" },
        { status: 403 },
      );
    }

    // 4. Use service role to clean up non-cascading rows and delete auth user
    const serviceSupabase = createServiceRoleClient();

    // Delete rows from tables that lack ON DELETE CASCADE
    await serviceSupabase
      .from("keepz_payments")
      .delete()
      .eq("user_id", user.id);

    await serviceSupabase
      .from("payment_audit_log")
      .delete()
      .eq("user_id", user.id);

    // 5. Delete auth user — this cascades to profiles and all other FK tables
    const { error: deleteError } = await serviceSupabase.auth.admin.deleteUser(
      user.id,
    );

    if (deleteError) {
      console.error("[DeleteAccount] Auth deletion error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[DeleteAccount] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify route directory exists**

Run: `ls app/api/account/delete/route.ts`

Expected: File exists at `app/api/account/delete/route.ts`

---

### Task 3: Add delete account UI to settings page

**Files:**

- Modify: `app/settings/page.tsx`

**Key insertion points:**

- State declarations: after line ~118 (after `const [passwordSuccess, setPasswordSuccess]`)
- Handler function: after `handlePasswordUpdate` (after line ~566)
- UI section: before the closing `</div></div></div>` at lines 1334-1336

- [ ] **Step 1: Add state variables for delete account**

After line 118 (`const [copiedLink, setCopiedLink] = useState<string | null>(null);`), add:

```typescript
// Delete account state
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [deleteConfirmText, setDeleteConfirmText] = useState("");
const [isDeletingAccount, setIsDeletingAccount] = useState(false);
```

- [ ] **Step 2: Add the delete account handler**

After the `handlePasswordUpdate` function (after line 566), add:

```typescript
const handleDeleteAccount = async () => {
  if (deleteConfirmText !== "Delete" || isDeletingAccount) return;

  setIsDeletingAccount(true);
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error(t("settings.deleteAccountError"));
      return;
    }

    const response = await fetch("/api/account/delete", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      const data = await response.json();
      if (data.error === "role_cannot_delete") {
        toast.error(t("settings.deleteAccountLecturerBlocked"));
      } else {
        toast.error(t("settings.deleteAccountError"));
      }
      return;
    }

    toast.success(t("settings.accountDeleted"));
    await supabase.auth.signOut();
    router.push("/");
  } catch (err) {
    console.error("[Settings] Delete account error:", err);
    toast.error(t("settings.deleteAccountError"));
  } finally {
    setIsDeletingAccount(false);
    setShowDeleteModal(false);
    setDeleteConfirmText("");
  }
};
```

- [ ] **Step 3: Add the danger zone UI section**

Before the closing tags at line 1334 (`</div>` that closes `<div className="bg-white dark:bg-navy-800...">` for the password section), insert a new section. Specifically, find this block at lines 1334-1336:

```
            </div>
          </div>
        </div>
```

Before that first `</div>` (line 1334), add the danger zone section AND the modal. The new code goes AFTER the password section's closing `</div>` (line 1334) but BEFORE `</div>` on line 1335 (which closes `<div className="space-y-6">`):

```tsx
{
  /* Delete Account Section */
}
<div className="bg-white dark:bg-navy-800 border border-red-200 dark:border-red-800/50 rounded-3xl p-6 shadow-soft">
  <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
    {t("settings.deleteAccount")}
  </h2>
  <p className="text-sm text-charcoal-600 dark:text-gray-400 mb-4">
    {t("settings.deleteAccountWarning")}
  </p>

  {userProfile?.role === "lecturer" || userProfile?.role === "admin" ? (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded-xl text-sm">
      {t("settings.deleteAccountLecturerBlocked")}
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setShowDeleteModal(true)}
      className="px-6 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {t("settings.deleteAccount")}
    </button>
  )}
</div>;

{
  /* Delete Account Confirmation Modal */
}
{
  showDeleteModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-navy-800 rounded-2xl p-6 max-w-md w-full shadow-xl border border-charcoal-100 dark:border-navy-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-charcoal-950 dark:text-white">
            {t("settings.deleteAccount")}
          </h3>
        </div>

        <p className="text-sm text-charcoal-600 dark:text-gray-400 mb-4">
          {t("settings.deleteAccountWarning")}
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
            {t("settings.typeDeleteToConfirm")}
          </label>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Delete"
            className="w-full px-4 py-2.5 border border-charcoal-200 dark:border-navy-600 rounded-xl bg-white dark:bg-navy-900 text-charcoal-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400"
            disabled={isDeletingAccount}
            autoComplete="off"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setShowDeleteModal(false);
              setDeleteConfirmText("");
            }}
            disabled={isDeletingAccount}
            className="flex-1 px-4 py-2.5 bg-charcoal-100 dark:bg-navy-700 text-charcoal-700 dark:text-gray-300 font-medium rounded-xl hover:bg-charcoal-200 dark:hover:bg-navy-600 transition-all duration-200 disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={deleteConfirmText !== "Delete" || isDeletingAccount}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isDeletingAccount ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {t("settings.processing")}
              </>
            ) : (
              t("settings.deleteAccountConfirmButton")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build` (or `npx next build`)

Expected: Build succeeds with no TypeScript errors.

---

### Task 4: Manual verification

- [ ] **Step 1: Test student flow**

1. Log in as a student
2. Go to Settings
3. Scroll to bottom — see red "Delete Account" section
4. Click "Delete Account" button — modal appears
5. Type "delete" (lowercase) — button stays disabled
6. Type "Delete" (correct) — button enables
7. Click confirm — account is deleted, redirected to home

- [ ] **Step 2: Test lecturer/admin flow**

1. Log in as a lecturer
2. Go to Settings
3. Scroll to bottom — see yellow warning message "Contact admin"
4. No delete button visible

- [ ] **Step 3: Verify cascade**
      After deleting a test student, check in Supabase Dashboard:
- `profiles` table: row gone
- `notifications` table: user's rows gone
- `keepz_payments` table: user's rows gone

---

### Task 5: Commit

- [ ] **Step 1: Stage and commit**

```bash
git add app/api/account/delete/route.ts app/settings/page.tsx locales/en.json locales/ge.json
git commit -m "feat: add delete account feature for students in settings

- DELETE /api/account/delete endpoint with service role
- Confirmation modal requiring user to type 'Delete'
- Lecturers and admins blocked from self-deletion
- Cleans up keepz_payments/payment_audit_log before cascade
- Bilingual EN/GE translations"
```
