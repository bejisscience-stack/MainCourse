# Agent 4 — Edge Function Error Hiding + Reason Sanitization

**Priority:** HIGH + MEDIUM
**Findings:** HIGH-04, MED-13

## Files to MODIFY

- `supabase/functions/enrollment-requests/index.ts`
- `supabase/functions/bundle-enrollment-requests/index.ts`
- `supabase/functions/withdrawals/index.ts`
- `supabase/functions/health/index.ts`
- `supabase/functions/chat-media/index.ts`
- `supabase/functions/admin-enrollment-reject/index.ts`
- `supabase/functions/admin-bundle-enrollment-reject/index.ts`
- `supabase/functions/admin-notifications-send/index.ts`

## Files you MUST NOT touch

All other files. Especially NOT: `supabase/functions/notifications/index.ts`, `supabase/functions/notification-read/index.ts`, `supabase/functions/notifications-read-all/index.ts`, `supabase/functions/notifications-unread-count/index.ts`, `supabase/functions/balance/index.ts`, `supabase/functions/validate-referral-code/index.ts`, `supabase/functions/admin-enrollment-requests/index.ts`, `supabase/functions/admin-withdrawals/index.ts`, `supabase/functions/admin-bundle-enrollment-requests/index.ts`, `lib/rate-limit.ts`, `lib/email-templates.ts`, any `app/api/` files.

## Task Part 1: Hide database error details (HIGH-04)

For each of the first 5 files:

1. Read the file completely
2. Find every place where `error.message`, `error.code`, `insertError.message`, `insertError.code`, `fetchError.message`, `requestCheckError.message`, or similar database error properties are returned in JSON responses to the client
3. Replace with a generic error message. Keep the `console.error()` logging for server-side debugging.

**Example — BEFORE:**

```typescript
return jsonResponse(
  {
    error: "Failed to create enrollment request",
    details: insertError.message, // ❌ Leaks DB internals
    code: insertError.code, // ❌ Leaks Postgres error code
  },
  500,
  cors,
);
```

**Example — AFTER:**

```typescript
console.error(
  "Failed to create enrollment request:",
  insertError.message,
  insertError.code,
);
return jsonResponse(
  {
    error: "Failed to create enrollment request",
  },
  500,
  cors,
);
```

**IMPORTANT:** Keep known error codes that produce user-friendly messages. For example, if there's a check like:

```typescript
if (insertError.code === "23505") {
  return jsonResponse(
    { error: "You already have a pending request" },
    400,
    cors,
  );
}
```

This is SAFE — it maps a known code to a user-friendly message without exposing the raw error. Keep these.

Only remove: `details: error.message`, `code: error.code`, raw `.message` strings returned to client.

## Task Part 2: Sanitize rejection reason (MED-13)

For `admin-enrollment-reject/index.ts`, `admin-bundle-enrollment-reject/index.ts`, and `admin-notifications-send/index.ts`:

1. Read each file
2. Find where `reason` (or notification `title`/`message`) is embedded into notification strings
3. Add a simple sanitization function at the top of the file:

```typescript
/** Strip HTML tags and limit length for safe embedding */
function sanitizeText(text: string, maxLength: number = 500): string {
  return text.replace(/<[^>]*>/g, "").slice(0, maxLength);
}
```

4. Apply `sanitizeText()` to the `reason` parameter before it's embedded into notification messages:

**Example — BEFORE:**

```typescript
p_message_en: `...${reason ? ` Reason: ${reason}` : ""}`,
```

**Example — AFTER:**

```typescript
p_message_en: `...${reason ? ` Reason: ${sanitizeText(reason)}` : ""}`,
```

For `admin-notifications-send/index.ts`, sanitize the notification `title` and `message` fields before they're stored or sent.

## Verification

Run `npm run build` to ensure no TypeScript compilation errors.

## Commit

```
fix: hide DB error details in edge functions + sanitize rejection reasons (HIGH-04, MED-13)
```

Output DONE when build passes.
