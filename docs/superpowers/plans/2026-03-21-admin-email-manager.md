# Admin Email Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin Email Manager tab with unified recipient table, filters, send history tracking, and a rich text email composer (TipTap) — fixing the existing email formatting bug along the way.

**Architecture:** New `email_send_history` Supabase table + `get_admin_email_list()` RPC for backend data. New `GET /api/admin/emails` route to serve data. Modified `POST /api/admin/notifications/send` route to log sends and accept HTML. New `RichTextEditor` (TipTap), `AdminEmailManager` components, and `useAdminEmails` hook on the frontend. Existing `AdminNotificationSender` gets the rich text editor for email mode.

**Tech Stack:** Next.js 14, Supabase (Postgres + RLS), TipTap (WYSIWYG), sanitize-html, SWR, Tailwind CSS, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-21-admin-email-manager-design.md`

---

### Task 1: Install npm dependencies

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install TipTap packages**

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-underline @tiptap/pm
```

- [ ] **Step 2: Install sanitize-html**

```bash
npm install sanitize-html @types/sanitize-html
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No TypeScript errors from new dependencies

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add tiptap and sanitize-html dependencies"
```

---

### Task 2: Database migration — email_send_history table + get_admin_email_list RPC

**Files:**

- Create: `supabase/migrations/184_email_send_history.sql`

**Context:**

- `decrypt_pii()` is defined in migration 143 and restricted to `service_role` in migration 174
- `coming_soon_emails` table (migration 090) stores plaintext email
- `profiles` table has `encrypted_email` column; decrypt via `decrypt_pii(encrypted_email)`
- `enrollments` table (migration 011) links `user_id` to `course_id`
- `check_is_admin(user_id)` RPC returns boolean
- This RPC must be called via service role client from the API route (not browser client)

- [ ] **Step 1: Write migration file**

Create `supabase/migrations/184_email_send_history.sql`:

```sql
-- ============================================
-- PART 1: email_send_history table
-- ============================================

CREATE TABLE IF NOT EXISTS public.email_send_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_by UUID NOT NULL REFERENCES auth.users(id),
  source TEXT NOT NULL DEFAULT 'admin_notification',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_send_history_recipient_email ON public.email_send_history(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_send_history_recipient_user_id ON public.email_send_history(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_email_send_history_sent_at ON public.email_send_history(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_history_sent_by ON public.email_send_history(sent_by);

-- RLS
ALTER TABLE public.email_send_history ENABLE ROW LEVEL SECURITY;

-- Admins can read
CREATE POLICY "admin_select_email_send_history" ON public.email_send_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- No INSERT policy needed: service role bypasses RLS.
-- Any non-service-role user is denied INSERT by default.

-- ============================================
-- PART 2: get_admin_email_list() RPC
-- ============================================

CREATE OR REPLACE FUNCTION public.get_admin_email_list()
RETURNS TABLE (
  email TEXT,
  source TEXT,
  user_id UUID,
  full_name TEXT,
  username TEXT,
  role TEXT,
  is_registered BOOLEAN,
  registered_at TIMESTAMPTZ,
  has_enrollment BOOLEAN,
  enrolled_courses_count INT,
  last_email_sent_at TIMESTAMPTZ,
  total_emails_sent INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Decrypt profile emails using LATERAL to avoid double-decryption
  profile_emails AS (
    SELECT
      LOWER(decrypted.email) AS email,
      p.id AS user_id,
      COALESCE(decrypted.full_name, p.full_name) AS full_name,
      p.username,
      p.role,
      p.created_at AS registered_at
    FROM public.profiles p,
    LATERAL (
      SELECT
        public.decrypt_pii(p.encrypted_email) AS email,
        public.decrypt_pii(p.encrypted_full_name) AS full_name
    ) decrypted
    WHERE p.encrypted_email IS NOT NULL
      AND decrypted.email LIKE '%@%'
  ),
  -- Coming soon emails (plaintext)
  cs_emails AS (
    SELECT LOWER(cs.email) AS email
    FROM public.coming_soon_emails cs
    WHERE cs.email IS NOT NULL AND cs.email LIKE '%@%'
  ),
  -- All unique emails with source classification
  all_emails AS (
    SELECT
      COALESCE(pe.email, cs.email) AS email,
      CASE
        WHEN pe.email IS NOT NULL AND cs.email IS NOT NULL THEN 'both'
        WHEN pe.email IS NOT NULL THEN 'profile'
        ELSE 'coming_soon'
      END AS source,
      pe.user_id,
      pe.full_name,
      pe.username,
      pe.role,
      pe.user_id IS NOT NULL AS is_registered,
      pe.registered_at
    FROM profile_emails pe
    FULL OUTER JOIN cs_emails cs ON pe.email = cs.email
  ),
  -- Enrollment counts per user
  enrollment_counts AS (
    SELECT
      e.user_id,
      COUNT(*)::INT AS cnt
    FROM public.enrollments e
    GROUP BY e.user_id
  ),
  -- Email send history stats
  send_stats AS (
    SELECT
      LOWER(h.recipient_email) AS email,
      MAX(h.sent_at) AS last_sent,
      COUNT(*)::INT AS total_sent
    FROM public.email_send_history h
    GROUP BY LOWER(h.recipient_email)
  )
  SELECT
    ae.email,
    ae.source,
    ae.user_id,
    ae.full_name,
    ae.username,
    ae.role,
    ae.is_registered,
    ae.registered_at,
    COALESCE(ec.cnt > 0, FALSE) AS has_enrollment,
    COALESCE(ec.cnt, 0) AS enrolled_courses_count,
    ss.last_sent AS last_email_sent_at,
    COALESCE(ss.total_sent, 0) AS total_emails_sent
  FROM all_emails ae
  LEFT JOIN enrollment_counts ec ON ae.user_id = ec.user_id
  LEFT JOIN send_stats ss ON ae.email = ss.email
  ORDER BY ae.email;
END;
$$;

-- Only service_role can execute this function (PII decryption)
REVOKE EXECUTE ON FUNCTION public.get_admin_email_list() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_admin_email_list() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_email_list() FROM anon;
```

- [ ] **Step 2: Apply migration to staging**

Use Supabase MCP or Dashboard SQL editor to apply to staging project `bvptqdmhuumjbyfnjxdt`.

- [ ] **Step 3: Verify — test the RPC**

Run via Dashboard SQL editor:

```sql
SELECT * FROM public.get_admin_email_list() LIMIT 5;
```

Expected: Rows with email, source, user_id, enrollment counts, etc.

- [ ] **Step 4: Verify — test email_send_history table**

```sql
INSERT INTO public.email_send_history (recipient_email, subject, sent_by)
VALUES ('test@example.com', 'Test Subject', (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1));

SELECT * FROM public.email_send_history;
-- Then clean up:
DELETE FROM public.email_send_history WHERE recipient_email = 'test@example.com';
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/184_email_send_history.sql
git commit -m "feat: add email_send_history table and get_admin_email_list RPC"
```

---

### Task 3: Update TypeScript types

**Files:**

- Modify: `types/notification.ts:59-70`
- Modify: `lib/email-templates.ts:13-22`

- [ ] **Step 1: Add message_html to AdminNotificationPayload**

In `types/notification.ts`, add `message_html` field to `AdminNotificationPayload` interface (after line 69):

```typescript
export interface AdminNotificationPayload {
  target_type: "all" | "role" | "course" | "specific";
  target_role?: "student" | "lecturer" | "admin";
  target_course_id?: string;
  target_user_ids?: string[];
  title: MultilingualText;
  message: MultilingualText;
  channel: "in_app" | "email" | "both";
  language: "en" | "ge" | "both";
  email_target?: "profiles" | "coming_soon" | "both" | "specific";
  target_emails?: string[];
  message_html?: { en?: string; ge?: string };
}
```

- [ ] **Step 2: Add messageHtml fields to EmailTemplateData**

In `lib/email-templates.ts`, extend `EmailTemplateData` (line 13):

```typescript
interface EmailTemplateData {
  username?: string;
  courseName?: string;
  amount?: number;
  reason?: string;
  titleEn?: string;
  titleGe?: string;
  messageEn?: string;
  messageGe?: string;
  messageHtmlEn?: string;
  messageHtmlGe?: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add types/notification.ts lib/email-templates.ts
git commit -m "feat: add message_html types for rich text email support"
```

---

### Task 4: Fix email templates — HTML support + line break bug

**Files:**

- Modify: `lib/email-templates.ts:315-347` (adminNotification template)

**Context:**

- Current bug: `escapeHtml()` on line 325 strips all formatting and `\n` is not converted to `<br>`
- Fix: When `messageHtmlEn`/`messageHtmlGe` exists, render directly (pre-sanitized server-side). When only plain text, convert `\n` → `<br>` after `escapeHtml()`.

- [ ] **Step 1: Update the adminNotification html template**

Replace the `adminNotification` entry in `lib/email-templates.ts` (lines 315-347) with:

```typescript
  adminNotification: {
    subject: {
      en: "Notification from Swavleba",
      ge: "შეტყობინება Swavleba-დან",
    },
    html: (data) =>
      emailWrapper(`
      ${
        data.titleEn
          ? `<h1 style="color: ${BRAND_COLOR}; margin-bottom: 24px;">${escapeHtml(data.titleEn)}</h1>
      <div style="color: #333; font-size: 16px; line-height: 1.6;">${
        data.messageHtmlEn
          ? data.messageHtmlEn
          : data.messageEn
            ? escapeHtml(data.messageEn).replace(/\n/g, "<br>")
            : ""
      }</div>`
          : ""
      }
      ${data.titleEn && data.titleGe ? '<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />' : ""}
      ${
        data.titleGe
          ? `<h1 style="color: ${BRAND_COLOR}; margin-bottom: 24px;">${escapeHtml(data.titleGe)}</h1>
      <div style="color: #333; font-size: 16px; line-height: 1.6;">${
        data.messageHtmlGe
          ? data.messageHtmlGe
          : data.messageGe
            ? escapeHtml(data.messageGe).replace(/\n/g, "<br>")
            : ""
      }</div>`
          : ""
      }
    `),
    text: (data) =>
      [
        data.titleEn
          ? `${escapeHtml(data.titleEn)}\n${
              data.messageHtmlEn
                ? data.messageHtmlEn.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "")
                : data.messageEn
                  ? escapeHtml(data.messageEn)
                  : ""
            }`
          : "",
        data.titleGe
          ? `${escapeHtml(data.titleGe)}\n${
              data.messageHtmlGe
                ? data.messageHtmlGe.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "")
                : data.messageGe
                  ? escapeHtml(data.messageGe)
                  : ""
            }`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n---\n\n"),
  },
```

- [ ] **Step 2: Commit**

```bash
git add lib/email-templates.ts
git commit -m "fix: support rich HTML in email templates and fix line break bug"
```

---

### Task 5: Update sendAdminNotificationEmail to accept HTML

**Files:**

- Modify: `lib/email.ts:207-236`

- [ ] **Step 1: Extend function signature and pass HTML through**

Replace `sendAdminNotificationEmail` in `lib/email.ts` (lines 207-236):

```typescript
/**
 * Send admin notification email (supports EN only, GE only, or both)
 * Optionally accepts pre-sanitized HTML for rich formatting
 */
export async function sendAdminNotificationEmail(
  to: string | string[],
  title: MultilingualText,
  message: MultilingualText,
  language: "en" | "ge" | "both" = "both",
  messageHtml?: { en?: string; ge?: string },
): Promise<string> {
  const template = emailTemplates.adminNotification;
  const subject =
    language === "en"
      ? title.en
      : language === "ge"
        ? title.ge
        : `${title.en} | ${title.ge}`;
  return sendEmail({
    to,
    subject,
    html: template.html({
      titleEn: language === "ge" ? "" : title.en,
      titleGe: language === "en" ? "" : title.ge,
      messageEn: language === "ge" ? "" : message.en,
      messageGe: language === "en" ? "" : message.ge,
      messageHtmlEn: language === "ge" ? undefined : messageHtml?.en,
      messageHtmlGe: language === "en" ? undefined : messageHtml?.ge,
    }),
    text: template.text({
      titleEn: language === "ge" ? "" : title.en,
      titleGe: language === "en" ? "" : title.ge,
      messageEn: language === "ge" ? "" : message.en,
      messageGe: language === "en" ? "" : message.ge,
      messageHtmlEn: language === "ge" ? undefined : messageHtml?.en,
      messageHtmlGe: language === "en" ? undefined : messageHtml?.ge,
    }),
  });
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add lib/email.ts
git commit -m "feat: extend sendAdminNotificationEmail to accept pre-sanitized HTML"
```

---

### Task 6: Create RichTextEditor component

**Files:**

- Create: `components/RichTextEditor.tsx`

**Context:**

- TipTap editor with toolbar matching admin panel design (navy/charcoal theme)
- Toolbar: Bold, Italic, Underline, H2, H3, Bullet List, Ordered List, Link
- Output: `onChange(html: string)` callback
- `'use client'` required (browser-only)

- [ ] **Step 1: Create the component**

Create `components/RichTextEditor.tsx`:

```typescript
"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { useCallback, useEffect } from "react";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

function ToolbarButton({
  onClick,
  isActive,
  title,
  children,
}: {
  onClick: () => void;
  isActive: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2 py-1.5 rounded text-sm font-medium transition-colors ${
        isActive
          ? "bg-navy-900 text-white"
          : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[120px] px-4 py-3 focus:outline-none text-gray-900",
      },
    },
  });

  // Sync external content changes (e.g. form reset)
  useEffect(() => {
    if (editor && content === "" && editor.getHTML() !== "<p></p>") {
      editor.commands.setContent("");
    }
  }, [content, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Enter URL:", previousUrl || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-navy-500 focus-within:border-navy-500">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="Bold"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="Italic"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          title="Underline"
        >
          <span className="underline">U</span>
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1 self-center" />

        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          isActive={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          isActive={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          H3
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1 self-center" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="Bullet List"
        >
          &bull; List
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="Numbered List"
        >
          1. List
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1 self-center" />

        <ToolbarButton
          onClick={setLink}
          isActive={editor.isActive("link")}
          title="Insert Link"
        >
          Link
        </ToolbarButton>
        {editor.isActive("link") && (
          <ToolbarButton
            onClick={() => editor.chain().focus().unsetLink().run()}
            isActive={false}
            title="Remove Link"
          >
            Unlink
          </ToolbarButton>
        )}
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />

      {/* Placeholder overlay */}
      {editor.isEmpty && placeholder && (
        <div className="px-4 -mt-[120px] pointer-events-none text-gray-400 text-sm">
          {placeholder}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Component compiles without errors

- [ ] **Step 3: Commit**

```bash
git add components/RichTextEditor.tsx
git commit -m "feat: add TipTap rich text editor component"
```

---

### Task 7: Create GET /api/admin/emails route

**Files:**

- Create: `app/api/admin/emails/route.ts`

**Context:**

- Follow pattern from `lib/admin-auth.ts`: `verifyAdminRequest()` returns `{ token, userId, serviceSupabase }` or `NextResponse` error
- Use `isAuthError()` to check result
- Call `get_admin_email_list()` via `serviceSupabase` (service role — needed for `decrypt_pii()`)
- Rate limit via `adminLimiter` from `lib/rate-limit.ts`
- Use `getClientIP()` for rate limit identifier

- [ ] **Step 1: Create the route**

Create `app/api/admin/emails/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminRequest,
  isAuthError,
  internalError,
} from "@/lib/admin-auth";
import { adminLimiter, rateLimitResponse, getClientIP } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIP(request);
    const { allowed, retryAfterMs } = await adminLimiter.check(
      `admin-emails:${ip}`,
    );
    if (!allowed) return rateLimitResponse(retryAfterMs);

    // Auth
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) return authResult;
    const { serviceSupabase } = authResult;

    // Fetch unified email list via service role (needed for decrypt_pii)
    const { data, error } = await serviceSupabase.rpc("get_admin_email_list");

    if (error) {
      console.error("[Admin Emails API] RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch email list" },
        { status: 500 },
      );
    }

    return NextResponse.json({ emails: data || [] });
  } catch (err) {
    return internalError("Admin Emails API", err);
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Route compiles without errors

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/emails/route.ts
git commit -m "feat: add GET /api/admin/emails route for unified email list"
```

---

### Task 8: Modify POST /api/admin/notifications/send — HTML sanitization + send history

**Files:**

- Modify: `app/api/admin/notifications/send/route.ts`

**Context:**

- Lines 1-12: imports — add `sanitize-html`
- Lines 438-474: email sending loop — add `messageHtml` passthrough + `email_send_history` INSERT
- Lines 212-240: body parsing — extract `message_html` field
- `createServiceRoleClient` already imported (line 4)
- Existing `serviceSupabase` variable available in the handler

- [ ] **Step 1: Add sanitize-html import and helper at top of file**

Add after existing imports (line 12):

```typescript
import sanitizeHtml from "sanitize-html";

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    "b",
    "i",
    "em",
    "strong",
    "a",
    "ul",
    "ol",
    "li",
    "p",
    "br",
    "h1",
    "h2",
    "h3",
    "hr",
    "u",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      target: "_blank",
      rel: "noopener noreferrer",
    }),
  },
  allowedSchemes: ["http", "https", "mailto"],
};

function sanitizeMessageHtml(
  html: { en?: string; ge?: string } | undefined,
): { en?: string; ge?: string } | undefined {
  if (!html) return undefined;
  const result: { en?: string; ge?: string } = {};
  if (html.en) {
    if (Buffer.byteLength(html.en, "utf8") > 50000) return undefined;
    result.en = sanitizeHtml(html.en, sanitizeOptions);
  }
  if (html.ge) {
    if (Buffer.byteLength(html.ge, "utf8") > 50000) return undefined;
    result.ge = sanitizeHtml(html.ge, sanitizeOptions);
  }
  return Object.keys(result).length > 0 ? result : undefined;
}
```

- [ ] **Step 2: Extract message_html from request body**

In the POST handler, after body parsing (around line 240 where `channel`, `language`, etc. are destructured), add:

```typescript
const message_html = sanitizeMessageHtml(body.message_html);
```

- [ ] **Step 3: Pass messageHtml to sendAdminNotificationEmail**

Replace the email sending call (line 465):

```typescript
// Before:
await sendAdminNotificationEmail(email, title, message, language);

// After:
await sendAdminNotificationEmail(email, title, message, language, message_html);
```

- [ ] **Step 4: Add email_send_history INSERT after each successful send**

Inside the email sending loop (after `emailSent++` on line 466), add history logging:

```typescript
emailSent++;
// Log to email_send_history (best-effort, don't block on failure)
try {
  await serviceSupabase.from("email_send_history").insert({
    recipient_email: email.toLowerCase(),
    recipient_user_id: null, // We don't have user_id in the email loop
    subject:
      language === "en"
        ? title.en
        : language === "ge"
          ? title.ge
          : `${title.en} | ${title.ge}`,
    sent_by: user.id,
    source: "admin_notification",
    metadata: { channel, language, target_type, email_target },
  });
} catch (historyErr) {
  console.error(
    "[Admin Notifications API] Failed to log email history:",
    historyErr,
  );
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/notifications/send/route.ts
git commit -m "feat: add HTML sanitization and email send history logging"
```

---

### Task 9: Create useAdminEmails hook

**Files:**

- Create: `hooks/useAdminEmails.ts`

**Context:**

- Follow pattern from `hooks/useAdminAnalytics.ts`: SWR + `fetchAnalytics<T>()` pattern using Bearer token
- Client-side filter/sort state is managed in the component, not the hook
- The hook just fetches and returns data

- [ ] **Step 1: Create the hook**

Create `hooks/useAdminEmails.ts`:

```typescript
import useSWR from "swr";
import { supabase } from "@/lib/supabase";

export interface AdminEmailEntry {
  email: string;
  source: "profile" | "coming_soon" | "both";
  user_id: string | null;
  full_name: string | null;
  username: string | null;
  role: string | null;
  is_registered: boolean;
  registered_at: string | null;
  has_enrollment: boolean;
  enrolled_courses_count: number;
  last_email_sent_at: string | null;
  total_emails_sent: number;
}

async function fetchAdminEmails(): Promise<AdminEmailEntry[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`/api/admin/emails?t=${Date.now()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.emails || [];
}

export function useAdminEmails() {
  const { data, error, isLoading, mutate } = useSWR<AdminEmailEntry[]>(
    "admin-emails",
    fetchAdminEmails,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    },
  );

  return {
    emails: data || [],
    isLoading,
    error,
    mutate,
  };
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add hooks/useAdminEmails.ts
git commit -m "feat: add useAdminEmails SWR hook"
```

---

### Task 10: Create AdminEmailManager component

**Files:**

- Create: `components/AdminEmailManager.tsx`

**Context:**

- Uses `useAdminEmails` hook for data
- Client-side filtering (search, source, registration, courses, email history, role)
- Checkbox row selection
- "Send Email to Selected" → compose modal with RichTextEditor
- Compose modal sends via existing `/api/admin/notifications/send` with `email_target: "specific"` and `target_emails`
- Matches admin panel design: white cards, navy-900 headings, gray-200 borders
- Bilingual compose (same language selector pattern as AdminNotificationSender)

- [ ] **Step 1: Create the component**

Create `components/AdminEmailManager.tsx`:

```typescript
"use client";

import { useState, useMemo, memo, useCallback } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { useAdminEmails, type AdminEmailEntry } from "@/hooks/useAdminEmails";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
  ),
});

type SourceFilter = "all" | "profile" | "coming_soon";
type RegistrationFilter = "all" | "registered" | "not_registered";
type CourseFilter = "all" | "has_courses" | "no_courses";
type EmailHistoryFilter = "all" | "never_emailed" | "emailed_before";
type RoleFilter = "all" | "student" | "lecturer" | "admin";
type SortKey = "email" | "registered_at" | "enrolled_courses_count" | "last_email_sent_at" | "total_emails_sent";

function AdminEmailManager() {
  const { emails, isLoading, error, mutate } = useAdminEmails();

  // Filters
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [registrationFilter, setRegistrationFilter] = useState<RegistrationFilter>("all");
  const [courseFilter, setCourseFilter] = useState<CourseFilter>("all");
  const [emailHistoryFilter, setEmailHistoryFilter] = useState<EmailHistoryFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("email");
  const [sortAsc, setSortAsc] = useState(true);

  // Selection
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  // Compose modal
  const [showCompose, setShowCompose] = useState(false);
  const [composeLanguage, setComposeLanguage] = useState<"en" | "ge" | "both">("both");
  const [subjectEn, setSubjectEn] = useState("");
  const [subjectGe, setSubjectGe] = useState("");
  const [messageHtmlEn, setMessageHtmlEn] = useState("");
  const [messageHtmlGe, setMessageHtmlGe] = useState("");
  const [messagePlainEn, setMessagePlainEn] = useState("");
  const [messagePlainGe, setMessagePlainGe] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Filtered + sorted emails
  const filteredEmails = useMemo(() => {
    let result = [...emails];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.email.toLowerCase().includes(q) ||
          (e.full_name && e.full_name.toLowerCase().includes(q)) ||
          (e.username && e.username.toLowerCase().includes(q)),
      );
    }

    // Source filter
    if (sourceFilter !== "all") {
      result = result.filter(
        (e) => e.source === sourceFilter || e.source === "both",
      );
    }

    // Registration
    if (registrationFilter === "registered") {
      result = result.filter((e) => e.is_registered);
    } else if (registrationFilter === "not_registered") {
      result = result.filter((e) => !e.is_registered);
    }

    // Courses
    if (courseFilter === "has_courses") {
      result = result.filter((e) => e.has_enrollment);
    } else if (courseFilter === "no_courses") {
      result = result.filter((e) => !e.has_enrollment);
    }

    // Email history
    if (emailHistoryFilter === "never_emailed") {
      result = result.filter((e) => e.total_emails_sent === 0);
    } else if (emailHistoryFilter === "emailed_before") {
      result = result.filter((e) => e.total_emails_sent > 0);
    }

    // Role
    if (roleFilter !== "all") {
      result = result.filter((e) => e.role === roleFilter);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "registered_at":
          cmp = (a.registered_at || "").localeCompare(b.registered_at || "");
          break;
        case "enrolled_courses_count":
          cmp = a.enrolled_courses_count - b.enrolled_courses_count;
          break;
        case "last_email_sent_at":
          cmp = (a.last_email_sent_at || "").localeCompare(b.last_email_sent_at || "");
          break;
        case "total_emails_sent":
          cmp = a.total_emails_sent - b.total_emails_sent;
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [emails, search, sourceFilter, registrationFilter, courseFilter, emailHistoryFilter, roleFilter, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const toggleEmail = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedEmails.size === filteredEmails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(filteredEmails.map((e) => e.email)));
    }
  };

  const openCompose = () => {
    if (selectedEmails.size === 0) return;
    setShowCompose(true);
    setSendResult(null);
  };

  const closeCompose = () => {
    setShowCompose(false);
    setSubjectEn("");
    setSubjectGe("");
    setMessageHtmlEn("");
    setMessageHtmlGe("");
    setMessagePlainEn("");
    setMessagePlainGe("");
    setSendResult(null);
  };

  const handleSend = useCallback(async () => {
    if (selectedEmails.size === 0) return;

    // Validate
    if ((composeLanguage === "en" || composeLanguage === "both") && !subjectEn.trim()) {
      setSendResult({ type: "error", message: "English subject is required" });
      return;
    }
    if ((composeLanguage === "ge" || composeLanguage === "both") && !subjectGe.trim()) {
      setSendResult({ type: "error", message: "Georgian subject is required" });
      return;
    }

    setIsSending(true);
    setSendResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const payload = {
        target_type: "all" as const,
        title: {
          en: composeLanguage === "ge" ? "" : subjectEn.trim(),
          ge: composeLanguage === "en" ? "" : subjectGe.trim(),
        },
        message: {
          en: composeLanguage === "ge" ? "" : messagePlainEn,
          ge: composeLanguage === "en" ? "" : messagePlainGe,
        },
        channel: "email" as const,
        language: composeLanguage,
        email_target: "specific" as const,
        target_emails: Array.from(selectedEmails),
        message_html: {
          en: composeLanguage === "ge" ? undefined : messageHtmlEn || undefined,
          ge: composeLanguage === "en" ? undefined : messageHtmlGe || undefined,
        },
      };

      const response = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to send");

      setSendResult({
        type: "success",
        message: `Sent ${data.email_count || 0} email(s)${data.email_failed_count ? `, ${data.email_failed_count} failed` : ""}`,
      });

      // Refresh email list to update send history
      mutate();
    } catch (err: any) {
      setSendResult({ type: "error", message: err.message || "Failed to send" });
    } finally {
      setIsSending(false);
    }
  }, [selectedEmails, composeLanguage, subjectEn, subjectGe, messageHtmlEn, messageHtmlGe, messagePlainEn, messagePlainGe, mutate]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const sourceBadge = (source: string) => {
    switch (source) {
      case "profile":
        return <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Registered</span>;
      case "coming_soon":
        return <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Subscriber</span>;
      case "both":
        return <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Both</span>;
      default:
        return null;
    }
  };

  const filterSelectClass = "px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-navy-500 focus:border-navy-500";

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortAsc ? " \u2191" : " \u2193";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-navy-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        Failed to load email list: {error.message || "Unknown error"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy-900">Email Manager</h2>
          <p className="text-gray-600 mt-1">
            {emails.length} total emails &middot; {filteredEmails.length} shown &middot; {selectedEmails.size} selected
          </p>
        </div>
        <button
          type="button"
          onClick={openCompose}
          disabled={selectedEmails.size === 0}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send Email to Selected ({selectedEmails.size})
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email, name..."
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Source</label>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as SourceFilter)} className={filterSelectClass}>
              <option value="all">All Sources</option>
              <option value="profile">Registered</option>
              <option value="coming_soon">Subscribers</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Registration</label>
            <select value={registrationFilter} onChange={(e) => setRegistrationFilter(e.target.value as RegistrationFilter)} className={filterSelectClass}>
              <option value="all">All</option>
              <option value="registered">Registered</option>
              <option value="not_registered">Not Registered</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Courses</label>
            <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value as CourseFilter)} className={filterSelectClass}>
              <option value="all">All</option>
              <option value="has_courses">Has Courses</option>
              <option value="no_courses">No Courses</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email History</label>
            <select value={emailHistoryFilter} onChange={(e) => setEmailHistoryFilter(e.target.value as EmailHistoryFilter)} className={filterSelectClass}>
              <option value="all">All</option>
              <option value="never_emailed">Never Emailed</option>
              <option value="emailed_before">Emailed Before</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as RoleFilter)} className={filterSelectClass}>
              <option value="all">All Roles</option>
              <option value="student">Student</option>
              <option value="lecturer">Lecturer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={filteredEmails.length > 0 && selectedEmails.size === filteredEmails.length}
                    onChange={toggleAll}
                    className="w-4 h-4 text-navy-600 border-gray-300 rounded focus:ring-navy-500"
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:text-navy-900" onClick={() => handleSort("email")}>
                  Email{sortIcon("email")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Source</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Role</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 cursor-pointer hover:text-navy-900" onClick={() => handleSort("enrolled_courses_count")}>
                  Courses{sortIcon("enrolled_courses_count")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:text-navy-900" onClick={() => handleSort("last_email_sent_at")}>
                  Last Emailed{sortIcon("last_email_sent_at")}
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 cursor-pointer hover:text-navy-900" onClick={() => handleSort("total_emails_sent")}>
                  Sent{sortIcon("total_emails_sent")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmails.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    No emails match the current filters
                  </td>
                </tr>
              ) : (
                filteredEmails.map((entry) => (
                  <tr
                    key={entry.email}
                    className={`transition-colors ${selectedEmails.has(entry.email) ? "bg-navy-50" : "hover:bg-gray-50"}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedEmails.has(entry.email)}
                        onChange={() => toggleEmail(entry.email)}
                        className="w-4 h-4 text-navy-600 border-gray-300 rounded focus:ring-navy-500"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{entry.email}</td>
                    <td className="px-4 py-3 text-gray-700">{entry.full_name || entry.username || "-"}</td>
                    <td className="px-4 py-3">{sourceBadge(entry.source)}</td>
                    <td className="px-4 py-3 text-gray-700 capitalize">{entry.role || "-"}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{entry.enrolled_courses_count}</td>
                    <td className="px-4 py-3 text-gray-700">{formatDate(entry.last_email_sent_at)}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{entry.total_emails_sent}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) closeCompose(); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-navy-900">
                Compose Email ({selectedEmails.size} recipient{selectedEmails.size !== 1 ? "s" : ""})
              </h3>
              <button type="button" onClick={closeCompose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            {sendResult && (
              <div className={`px-4 py-3 rounded-lg text-sm ${sendResult.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                {sendResult.message}
              </div>
            )}

            {/* Language selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Language</label>
              <div className="grid grid-cols-3 gap-2">
                {(["en", "ge", "both"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setComposeLanguage(lang)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${composeLanguage === lang ? "border-navy-900 bg-navy-50 text-navy-900" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"}`}
                  >
                    {lang === "en" ? "English" : lang === "ge" ? "Georgian" : "Both"}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div className={`grid gap-4 ${composeLanguage === "both" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
              {(composeLanguage === "en" || composeLanguage === "both") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject (English) *</label>
                  <input
                    type="text"
                    value={subjectEn}
                    onChange={(e) => setSubjectEn(e.target.value)}
                    placeholder="Email subject in English"
                    maxLength={200}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900"
                  />
                </div>
              )}
              {(composeLanguage === "ge" || composeLanguage === "both") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject (Georgian) *</label>
                  <input
                    type="text"
                    value={subjectGe}
                    onChange={(e) => setSubjectGe(e.target.value)}
                    placeholder="ელ-ფოსტის სათაური ქართულად"
                    maxLength={200}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900"
                  />
                </div>
              )}
            </div>

            {/* Message body (Rich Text) */}
            <div className={`grid gap-4 ${composeLanguage === "both" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
              {(composeLanguage === "en" || composeLanguage === "both") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message (English)</label>
                  <RichTextEditor
                    content={messageHtmlEn}
                    onChange={setMessageHtmlEn}
                    placeholder="Compose your email message in English..."
                  />
                </div>
              )}
              {(composeLanguage === "ge" || composeLanguage === "both") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message (Georgian)</label>
                  <RichTextEditor
                    content={messageHtmlGe}
                    onChange={setMessageHtmlGe}
                    placeholder="შეიყვანეთ შეტყობინების ტექსტი ქართულად..."
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={closeCompose}
                className="px-6 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={isSending}
                className="px-6 py-2 text-sm font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? "Sending..." : `Send to ${selectedEmails.size} recipient(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(AdminEmailManager);
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Component compiles without errors

- [ ] **Step 3: Commit**

```bash
git add components/AdminEmailManager.tsx
git commit -m "feat: add AdminEmailManager component with filters, table, and compose modal"
```

---

### Task 11: Update AdminNotificationSender — rich text for email mode

**Files:**

- Modify: `components/AdminNotificationSender.tsx`

**Context:**

- Lines 27: `channel` state controls mode
- Lines 1092-1098: English message textarea
- Lines 1101-1112: Georgian message textarea
- Replace textareas with `RichTextEditor` when `channel` is `"email"` or `"both"`
- Keep plain textarea for `"in_app"` only
- Need to add `message_html` to the payload sent to the API (line 306-323)
- Need state for HTML content separate from plain text

- [ ] **Step 1: Add dynamic import for RichTextEditor and HTML state**

At top of file, after existing imports (line 8), add:

```typescript
import dynamic from "next/dynamic";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
  loading: () => <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />,
});
```

Inside the component function (after line 65 `showPreview` state), add:

```typescript
const [messageHtmlEn, setMessageHtmlEn] = useState("");
const [messageHtmlGe, setMessageHtmlGe] = useState("");
```

- [ ] **Step 2: Replace message textareas with conditional RichTextEditor**

Replace the English message textarea (lines 1087-1099):

```typescript
{(notifLanguage === "en" || notifLanguage === "both") && (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Message (English) *
    </label>
    {channel === "in_app" ? (
      <textarea
        value={messageEn}
        onChange={(e) => setMessageEn(e.target.value)}
        placeholder="Enter notification message in English"
        rows={4}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900 resize-none"
      />
    ) : (
      <RichTextEditor
        content={messageHtmlEn}
        onChange={(html) => {
          setMessageHtmlEn(html);
          setMessageEn(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, ""));
        }}
        placeholder="Enter notification message in English"
      />
    )}
  </div>
)}
```

Replace the Georgian message textarea (lines 1101-1112) similarly:

```typescript
{(notifLanguage === "ge" || notifLanguage === "both") && (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Message (Georgian) *
    </label>
    {channel === "in_app" ? (
      <textarea
        value={messageGe}
        onChange={(e) => setMessageGe(e.target.value)}
        placeholder="შეიყვანეთ შეტყობინების ტექსტი ქართულად"
        rows={4}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900 resize-none"
      />
    ) : (
      <RichTextEditor
        content={messageHtmlGe}
        onChange={(html) => {
          setMessageHtmlGe(html);
          setMessageGe(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, ""));
        }}
        placeholder="შეიყვანეთ შეტყობინების ტექსტი ქართულად"
      />
    )}
  </div>
)}
```

- [ ] **Step 3: Add message_html to payload**

In the `handleSend` function, update the payload construction (around line 306). After the `message` field, add:

```typescript
const payload: AdminNotificationPayload = {
  // ... existing fields ...
  message: {
    en: notifLanguage === "ge" ? "" : messageEn.trim(),
    ge: notifLanguage === "en" ? "" : messageGe.trim(),
  },
  // Add message_html when channel includes email
  ...(channel !== "in_app" &&
    (messageHtmlEn || messageHtmlGe) && {
      message_html: {
        en: notifLanguage === "ge" ? undefined : messageHtmlEn || undefined,
        ge: notifLanguage === "en" ? undefined : messageHtmlGe || undefined,
      },
    }),
  // ... rest of existing fields ...
};
```

- [ ] **Step 4: Reset HTML state on form reset**

In the form reset block (around line 373-381), add:

```typescript
setMessageHtmlEn("");
setMessageHtmlGe("");
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add components/AdminNotificationSender.tsx
git commit -m "feat: add rich text editor to notification sender for email mode"
```

---

### Task 12: Wire email-manager tab into admin dashboard

**Files:**

- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Add dynamic import for AdminEmailManager**

After the `AdminSettings` dynamic import (line 37), add:

```typescript
const AdminEmailManager = dynamic(
  () => import("@/components/AdminEmailManager"),
  { ssr: false },
);
```

- [ ] **Step 2: Add email-manager to TabType**

Update `TabType` (line 44-52):

```typescript
type TabType =
  | "overview"
  | "view-bot"
  | "withdrawals"
  | "lecturers"
  | "courses"
  | "notifications"
  | "email-manager"
  | "analytics"
  | "settings";
```

- [ ] **Step 3: Add tab button**

After the "Send Notifications" tab button (around line 371), add:

```typescript
<button
  onClick={() => setActiveTab("email-manager")}
  className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
    activeTab === "email-manager"
      ? "text-navy-900 border-navy-900"
      : "text-navy-600 border-transparent hover:text-navy-900 hover:border-navy-300"
  }`}
>
  Email Manager
</button>
```

- [ ] **Step 4: Add tab content**

After the notifications tab content block (after line 564), add:

```typescript
{activeTab === "email-manager" && (
  <ErrorBoundary
    onError={(error) =>
      console.error(
        "[Admin Dashboard] Email Manager section error:",
        error,
      )
    }
  >
    <AdminEmailManager />
  </ErrorBoundary>
)}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: add Email Manager tab to admin dashboard"
```

---

### Task 13: Add locale keys

**Files:**

- Modify: `locales/en.json`
- Modify: `locales/ge.json`

- [ ] **Step 1: Add English locale keys**

Add an `"emailManager"` section to `locales/en.json`:

```json
"emailManager": {
  "title": "Email Manager",
  "subtitle": "Manage and send emails to users",
  "search": "Search email, name...",
  "source": "Source",
  "registration": "Registration",
  "courses": "Courses",
  "emailHistory": "Email History",
  "role": "Role",
  "allSources": "All Sources",
  "registered": "Registered",
  "subscribers": "Subscribers",
  "notRegistered": "Not Registered",
  "hasCourses": "Has Courses",
  "noCourses": "No Courses",
  "neverEmailed": "Never Emailed",
  "emailedBefore": "Emailed Before",
  "allRoles": "All Roles",
  "sendToSelected": "Send Email to Selected",
  "composeEmail": "Compose Email",
  "subject": "Subject",
  "message": "Message",
  "send": "Send",
  "sending": "Sending...",
  "noResults": "No emails match the current filters",
  "lastEmailed": "Last Emailed",
  "totalSent": "Total Sent",
  "name": "Name"
}
```

- [ ] **Step 2: Add Georgian locale keys**

Add an `"emailManager"` section to `locales/ge.json`:

```json
"emailManager": {
  "title": "ელ-ფოსტის მართვა",
  "subtitle": "მართეთ და გაგზავნეთ ელ-ფოსტა მომხმარებლებს",
  "search": "ძიება ელ-ფოსტით, სახელით...",
  "source": "წყარო",
  "registration": "რეგისტრაცია",
  "courses": "კურსები",
  "emailHistory": "ელ-ფოსტის ისტორია",
  "role": "როლი",
  "allSources": "ყველა წყარო",
  "registered": "რეგისტრირებული",
  "subscribers": "გამომწერები",
  "notRegistered": "არარეგისტრირებული",
  "hasCourses": "აქვს კურსები",
  "noCourses": "არ აქვს კურსები",
  "neverEmailed": "არასდროს გაგზავნილი",
  "emailedBefore": "გაგზავნილი ადრე",
  "allRoles": "ყველა როლი",
  "sendToSelected": "გაგზავნა არჩეულებზე",
  "composeEmail": "ელ-ფოსტის შედგენა",
  "subject": "სათაური",
  "message": "შეტყობინება",
  "send": "გაგზავნა",
  "sending": "იგზავნება...",
  "noResults": "ელ-ფოსტა ვერ მოიძებნა მიმდინარე ფილტრებით",
  "lastEmailed": "ბოლო გაგზავნა",
  "totalSent": "სულ გაგზავნილი",
  "name": "სახელი"
}
```

- [ ] **Step 3: Commit**

```bash
git add locales/en.json locales/ge.json
git commit -m "feat: add email manager locale keys for en and ge"
```

---

### Task 14: Manual verification

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Navigate to admin dashboard**

Go to `/admin` and verify the "Email Manager" tab appears.

- [ ] **Step 3: Test email list loading**

Click "Email Manager" tab. Verify the table loads with emails from both profiles and coming_soon_emails.

- [ ] **Step 4: Test filters**

Try each filter combination:

- Source: Registered only → only profile emails shown
- Registration: Not Registered → only coming_soon-only emails
- Courses: Has Courses → only users with enrollments
- Email History: Never Emailed → all rows show "-" for last emailed (expected for new feature)

- [ ] **Step 5: Test compose and send**

1. Select 1-2 test emails
2. Click "Send Email to Selected"
3. Choose language, enter subject, compose message with bold/italic/link formatting
4. Send
5. Verify email arrives with proper formatting
6. Refresh page → "Last Emailed" and "Total Sent" columns should update

- [ ] **Step 6: Test existing notification sender**

Go to "Send Notifications" tab, set channel to "Email" or "Both".
Verify the rich text editor appears instead of the plain textarea.
Verify in-app-only still shows the plain textarea.

- [ ] **Step 7: Test line break fix**

In the existing notification sender with plain text mode (in-app only), type multi-line text.
Switch to email mode and send — verify line breaks render as `<br>` in the received email.

- [ ] **Step 8: Final build check**

Run: `npm run build`
Expected: Clean build with no errors
