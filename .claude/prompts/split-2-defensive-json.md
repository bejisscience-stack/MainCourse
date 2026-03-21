# Agent 2: Add defensive JSON parsing in client-side code

## Problem

When API routes return HTML instead of JSON (e.g., during server errors), client-side code that calls `response.json()` directly crashes with "Unexpected token '<', '<!DOCTYPE'... is not valid JSON". This raw error is confusing for users.

Three files call `response.json()` without first checking if the response is actually JSON.

## Fixes

### Fix 1: `hooks/useAdminWithdrawalRequests.ts` (line 34)

The error path at line 33-34 calls `response.json()` on non-OK responses without checking content type. If the server returns HTML, this throws.

**Replace lines 33-42:**

```typescript
if (!response.ok) {
  const errorData = await response.json();
  // If withdrawal system isn't configured yet, return empty array instead of error
  if (response.status === 500 && errorData.error?.includes("does not exist")) {
    return [];
  }
  throw new Error(errorData.error || "Failed to fetch withdrawal requests");
}
```

**With:**

```typescript
if (!response.ok) {
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error(`Server error (${response.status})`);
  }
  const errorData = await response.json();
  // If withdrawal system isn't configured yet, return empty array instead of error
  if (response.status === 500 && errorData.error?.includes("does not exist")) {
    return [];
  }
  throw new Error(errorData.error || "Failed to fetch withdrawal requests");
}
```

### Fix 2: `app/complete-profile/page.tsx` (line 55)

Line 55 calls `response.json()` before checking `response.ok`. If the response is HTML, this crashes.

**Replace line 55:**

```typescript
const result = await response.json();
```

**With:**

```typescript
const contentType = response.headers.get("content-type");
if (!contentType || !contentType.includes("application/json")) {
  throw new Error(t("auth.somethingWentWrong"));
}
const result = await response.json();
```

### Fix 3: `components/AdminNotificationSender.tsx` (line 331)

Line 331 calls `response.json()` without checking content type.

**Replace line 331:**

```typescript
const data = await response.json();
```

**With:**

```typescript
const contentType = response.headers.get("content-type");
if (!contentType || !contentType.includes("application/json")) {
  throw new Error(`Server error (${response.status})`);
}
const data = await response.json();
```

## Files to modify

- `hooks/useAdminWithdrawalRequests.ts`
- `app/complete-profile/page.tsx`
- `components/AdminNotificationSender.tsx`

## Files NOT to touch (owned by Agent 1)

- `lib/rate-limit.ts`

## Verification

Run `npm run build`. Commit with message "fix: defensive JSON parsing in client hooks — show friendly errors instead of raw HTML parse failures". Output DONE when build passes.
