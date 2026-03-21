# Agent 2 — Email Template HTML Escaping

**Priority:** CRITICAL
**Finding:** CRIT-02

## Files to MODIFY

- `lib/email-templates.ts`
- `supabase/functions/_shared/email.ts`

## Files you MUST NOT touch

Everything else. No migrations, no API routes, no edge function index.ts files, no components.

## Task

### 1. Add `escapeHtml` helper to `lib/email-templates.ts`

Add this helper function near the top of the file (after imports, before templates):

```typescript
/** Escape HTML entities to prevent injection in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
```

### 2. Apply `escapeHtml()` to ALL user-supplied interpolations in `lib/email-templates.ts`

Read the file carefully and wrap every template literal interpolation that contains user-supplied data:

- `${data.courseName}` → `${escapeHtml(data.courseName || '')}`
- `${data.username}` → `${escapeHtml(data.username || '')}`
- `${data.reason}` → `${escapeHtml(data.reason || '')}`
- `${data.titleEn}` → `${escapeHtml(data.titleEn || '')}`
- `${data.titleGe}` → `${escapeHtml(data.titleGe || '')}`
- `${data.messageEn}` → `${escapeHtml(data.messageEn || '')}`
- `${data.messageGe}` → `${escapeHtml(data.messageGe || '')}`
- `${data.bundleName}` → `${escapeHtml(data.bundleName || '')}` (if present)
- Any other user-supplied string fields

**Do NOT escape:**

- Numeric values like `${data.amount}` (numbers are safe)
- Hardcoded strings
- HTML structure (the template's own tags)

### 3. Add `escapeHtml` helper to `supabase/functions/_shared/email.ts`

This file also has email templates for edge functions. Add the same `escapeHtml` function and apply it to all user-supplied interpolations. Read the file to find every template string that embeds user data (course names, rejection reasons, notification content, etc.) and escape them.

The edge function version should be identical logic:

```typescript
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
```

## Verification

Run `npm run build` to ensure no TypeScript compilation errors.

## Commit

```
fix: escape HTML in all email templates to prevent injection (CRIT-02)
```

Output DONE when build passes.
