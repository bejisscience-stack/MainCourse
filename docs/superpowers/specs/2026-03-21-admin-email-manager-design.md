# Admin Email Manager — Design Spec

## Problem

1. **No email history tracking**: Admin sends emails but has no record of who received what and when. The audit log only stores bulk metadata (counts), not per-recipient records.
2. **No filtering**: Admin cannot differentiate recipients by registration status, course purchases, or email history before sending.
3. **No email formatting**: The compose textarea outputs plain text. `escapeHtml()` in `lib/email-templates.ts:325` strips all formatting. Line breaks (`\n`) are not converted to `<br>`. No bold, italic, links, or lists.

## Solution

Two coordinated changes:

### A. Rich Text Email Composer

Replace the plain `<textarea>` with a TipTap WYSIWYG editor for email message composition. TipTap outputs sanitized HTML that flows directly into the email template.

### B. Email Manager Admin Tab

A new admin dashboard tab with a unified recipient table, filters, row selection, send history, and inline compose via modal.

---

## Architecture

### Data Layer

#### New Table: `email_send_history`

```sql
CREATE TABLE email_send_history (
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
```

- **Indexes**: `recipient_email`, `recipient_user_id`, `sent_at`, `sent_by`
- **RLS**: Admin-only SELECT. Service role INSERT (called from API route with service client).
- **Privacy**: Stores recipient email (needed for history lookup) but NOT email body content. Only subject + metadata (channel, language, target_type).

#### New RPC: `get_admin_email_list()`

Returns a unified view of all email recipients with enrichment data.

```sql
RETURNS TABLE (
  email TEXT,
  source TEXT,              -- 'profile' | 'coming_soon' | 'both'
  user_id UUID,             -- NULL for coming_soon-only
  full_name TEXT,            -- NULL for coming_soon-only
  username TEXT,             -- NULL for coming_soon-only
  role TEXT,                 -- NULL for coming_soon-only
  is_registered BOOLEAN,
  registered_at TIMESTAMPTZ, -- profiles.created_at
  has_enrollment BOOLEAN,
  enrolled_courses_count INT,
  last_email_sent_at TIMESTAMPTZ,
  total_emails_sent INT
)
```

**Logic**:

1. UNION of decrypted profile emails + coming_soon_emails (deduplicated by lowercase email)
2. LEFT JOIN enrollments (grouped by user_id) for course counts
3. LEFT JOIN email_send_history (grouped by recipient_email) for send stats
4. Admin-only access (SECURITY DEFINER with admin check)

**Security**: Uses `decrypt_pii()` internally. Since migration 174 revoked `decrypt_pii()` from all roles except `service_role`, this RPC must be called via the service role client from a server-side API route — NOT from the user's authenticated browser client. The `GET /api/admin/emails` route handles this by using `createServiceRoleClient()` to call the RPC after verifying admin status via the user's Bearer token. Decrypted emails are only returned to verified admins, never cached client-side beyond SWR.

**Note**: `coming_soon_emails.email` is stored as plaintext (not encrypted). Profile emails are encrypted via `encrypt_pii()`. The RPC handles this asymmetry: it calls `decrypt_pii()` for profile emails but reads `coming_soon_emails.email` directly. Deduplication uses `LOWER()` on both sources.

### API Layer

#### Modified: `POST /api/admin/notifications/send`

Changes:

1. Accept optional `message_html` field (`{en?: string, ge?: string}`) alongside existing `message` field
2. When `message_html` is provided and channel includes email, use HTML content for email template
3. Server-side HTML sanitization using `sanitize-html` (allow: `b`, `i`, `em`, `strong`, `a`, `ul`, `ol`, `li`, `p`, `br`, `h1`-`h3`, `hr`; strip all else including `script`, `style`, `iframe`, event handlers). Note: `sanitize-html` is pure JS with no `jsdom` dependency (~50KB), unlike `isomorphic-dompurify` which pulls in `jsdom` (~10MB).
4. After each successful email send, INSERT into `email_send_history` with service role client
5. Log recipient_email + subject only — never log email body to email_send_history

#### New: `GET /api/admin/emails`

Calls `get_admin_email_list()` RPC via `createServiceRoleClient()`. Returns the unified email list. Admin-only (Bearer token → `verifyTokenAndGetUser` → `check_is_admin`). Rate limited via `adminLimiter`.

### Component Layer

#### New: `components/RichTextEditor.tsx`

TipTap-based WYSIWYG editor with toolbar:

- **Formatting**: Bold, Italic, Underline
- **Structure**: Heading (H2, H3), Bullet list, Ordered list
- **Links**: Insert/edit link with URL validation
- **Line breaks**: Enter = new paragraph, Shift+Enter = `<br>`
- **Output**: `onChange(html: string)` callback
- **Styling**: Matches existing admin panel design (navy/charcoal theme)
- **No image upload**: Emails should be text-focused; images add deliverability risk

#### New: `components/AdminEmailManager.tsx`

Main email management panel with:

**Table columns**:
| Column | Source |
|--------|--------|
| Email | Decrypted from profiles / coming_soon_emails |
| Name | profiles.full_name (or username) |
| Source | Badge: "Registered" / "Subscriber" / "Both" |
| Role | profiles.role (or "-" for non-registered) |
| Courses | Count of enrollments |
| Last Emailed | email_send_history.sent_at (most recent) |
| Total Sent | Count of email_send_history rows |

**Filters** (client-side filtering on fetched data, server-side pagination):

- Search: text search on email/name
- Source: All / Registered Users / Coming Soon Only
- Registration: All / Registered / Not Registered
- Has Courses: All / Yes / No
- Email History: All / Never Emailed / Emailed Before
- Role: All / Student / Lecturer / Admin

**Actions**:

- Checkbox selection on rows
- "Select All (filtered)" button
- "Send Email to Selected" button → opens compose modal
- Compose modal: language selector + subject + RichTextEditor + preview + send button

#### Modified: `components/AdminNotificationSender.tsx`

Replace `<textarea>` for message fields with `RichTextEditor` when channel includes "email". Keep plain textarea for in-app-only notifications (in-app notifications are plain text).

#### New: `hooks/useAdminEmails.ts`

```typescript
export function useAdminEmails() {
  // SWR hook calling GET /api/admin/emails
  // Returns: { emails, isLoading, error, mutate }
  // Client-side filter/sort state management
  // Pagination state
}
```

#### Modified: `app/admin/page.tsx`

- Add `'email-manager'` to `TabType` union
- Add dynamic import for `AdminEmailManager`
- Add tab button in the tab bar

### Email Sending Layer

#### Modified: `lib/email.ts`

The `sendAdminNotificationEmail()` function signature must be extended to accept optional HTML content:

```typescript
export async function sendAdminNotificationEmail(
  to: string,
  title: MultilingualText,
  message: MultilingualText,
  language: "en" | "ge" | "both",
  messageHtml?: { en?: string; ge?: string }, // NEW — pre-sanitized HTML
);
```

When `messageHtml` is provided, pass `messageHtmlEn` / `messageHtmlGe` fields into `EmailTemplateData` for the template to use.

#### Modified: `lib/email-templates.ts`

Extend `EmailTemplateData` interface with optional fields:

- `messageHtmlEn?: string` — pre-sanitized HTML for English email body
- `messageHtmlGe?: string` — pre-sanitized HTML for Georgian email body

The `adminNotification` template:

- When `messageHtmlEn` / `messageHtmlGe` is provided, render it directly (already sanitized server-side) instead of calling `escapeHtml()` on plain text
- When only plain `messageEn` / `messageGe` is provided (backward compat), convert `\n` to `<br>` after `escapeHtml()` — this also fixes the line break bug for the existing notification sender
- The `text()` function: when HTML content is provided, strip tags to produce plain text fallback (replace `<br>` and `</p>` with `\n`, strip all other tags)

### Locales

Add keys to both `locales/en.json` and `locales/ge.json`:

- Tab label: "Email Manager" / "ელ-ფოსტის მართვა"
- Column headers, filter labels, button text, empty states
- Compose modal labels

---

## Security Design

### PII Protection

1. **Decrypted emails never leave admin context**: `get_admin_email_list()` is SECURITY DEFINER with `check_is_admin(auth.uid())` guard. Non-admin calls return empty.
2. **No client-side email caching beyond SWR**: SWR cache is in-memory only, cleared on navigation.
3. **email_send_history stores email but not body**: Only subject + metadata for audit trail. No message content persisted.
4. **RLS on email_send_history**: Only admins can SELECT. Only service role can INSERT (via API route).
5. **HTML sanitization**: Server-side `sanitize-html` before email send. Allowlist-only tags. No user-controlled attributes beyond `href` on `<a>` tags (`target="_blank"` and `rel="noopener noreferrer"` auto-added). `javascript:` URIs in `href` are blocked by `sanitize-html` by default.

### Authorization

- All endpoints require admin verification via `check_is_admin()` RPC
- Rate limiting via existing `adminLimiter` on both `POST /api/admin/notifications/send` and `GET /api/admin/emails`
- Audit logging for all email sends (existing `logAdminAction`)

### Input Validation

- Email addresses validated with regex before send
- UUID validation on user IDs
- Max 100 recipients per send (existing cap)
- HTML content max 50KB per language
- Subject max 200 characters

---

## Migration Number

Next migration: `184_email_send_history.sql` (migrations 183 already exist: `183_set_search_path_and_auth_guards.sql` and `183_video_enrollment_expiry_check.sql`). Table + RPC in a single migration file following existing project convention (e.g., migration 143).

## Dependencies

New npm packages:

- `@tiptap/react` — React bindings
- `@tiptap/starter-kit` — Core extensions (bold, italic, lists, headings, etc.)
- `@tiptap/extension-link` — Link support
- `@tiptap/extension-underline` — Underline support
- `sanitize-html` — Server-side HTML sanitization (pure JS, no jsdom dependency, ~50KB)
- `@types/sanitize-html` — TypeScript types

## Types to Update

- `types/notification.ts` — Add `message_html?: { en?: string; ge?: string }` to `AdminNotificationPayload`
- `lib/email-templates.ts` — Add `messageHtmlEn?: string; messageHtmlGe?: string` to `EmailTemplateData`

## Task Order

1. Install npm dependencies (tiptap + sanitize-html)
2. Migration `184_email_send_history.sql`: table + indexes + RLS + `get_admin_email_list()` RPC (single file)
3. `components/RichTextEditor.tsx` — TipTap editor component
4. Update `types/notification.ts` — add `message_html` to `AdminNotificationPayload`
5. Fix `lib/email-templates.ts` — extend `EmailTemplateData`, accept HTML + fix `\n` → `<br>` fallback + plain text fallback for HTML content
6. Fix `lib/email.ts` — extend `sendAdminNotificationEmail()` to accept + pass through `messageHtml`
7. `GET /api/admin/emails` — new API route (service role client, admin auth, rate limited)
8. Modify `POST /api/admin/notifications/send` — HTML sanitization via `sanitize-html` + email_send_history INSERT
9. `hooks/useAdminEmails.ts` — SWR hook
10. `components/AdminEmailManager.tsx` — table + filters + compose modal
11. Modify `components/AdminNotificationSender.tsx` — use RichTextEditor for email mode
12. Modify `app/admin/page.tsx` — add email-manager tab
13. Add locale keys to `en.json` + `ge.json`

## Edge Cases

- **Duplicate emails**: coming_soon email that also has a profile → show as "Both" source, deduplicate by lowercase email in RPC
- **Encrypted email decrypt failure**: `decrypt_pii()` has graceful fallback (returns the encrypted base64 value). RPC filters results by checking if the decrypted value contains `@` — rows where it doesn't are excluded (failed decryption returns a base64 string without `@`).
- **Large recipient lists**: RPC uses pagination (LIMIT/OFFSET). Client fetches in pages of 50.
- **Backward compatibility**: Existing notification sender still works with plain text. HTML is opt-in via `message_html` field.
- **Empty email_send_history**: New feature — no historical data. "Last Emailed" column shows "-" for all recipients initially. This is expected and communicated in the UI.
