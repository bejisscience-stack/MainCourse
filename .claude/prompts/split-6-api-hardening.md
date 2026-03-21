# Split 6: API Route Hardening (SEC-09, SEC-19, SEC-27, SEC-33, SEC-34, SEC-37, SEC-39)

## Scope

Fix security issues across multiple API routes. You ONLY touch files listed below.

## Files to Modify

- `app/api/profile/route.ts`
- `app/api/courses/[courseId]/video-url/route.ts`
- `app/api/notifications/route.ts`
- `app/api/admin/withdrawals/[requestId]/approve/route.ts`
- `app/api/me/enrollments/route.ts`
- `app/api/courses/[courseId]/chats/route.ts`
- `app/api/admin/enrollment-requests/test/route.ts`
- `app/api/validate-referral-code/route.ts`
- `app/api/admin/enrollment-requests/route.ts`
- `app/api/admin/bundle-enrollment-requests/route.ts`

## DO NOT Touch

- `app/api/payments/` (Agent 1)
- `lib/rate-limit.ts` (Agent 2)
- `lib/supabase-server.ts` (Agent 2)
- `middleware.ts` (Agent 7)
- Any `supabase/migrations/` files (Agents 3-5)
- Any `supabase/functions/` files (Agent 7)

## Fixes

### SEC-09: Validate avatar_url against Supabase storage pattern (HIGH)

**File:** `app/api/profile/route.ts`

Find where `avatar_url` is stored (~line 87-88). Add URL validation before saving:

```typescript
// Add this validation before updateData.avatar_url assignment:
if (avatar_url !== undefined) {
  if (avatar_url !== null && avatar_url !== "") {
    // Only allow Supabase storage URLs
    const supabaseUrlPattern = /^https:\/\/[a-z]+\.supabase\.co\/storage\/v1\//;
    if (!supabaseUrlPattern.test(avatar_url)) {
      return NextResponse.json(
        { error: "Invalid avatar URL — must be a Supabase storage URL" },
        { status: 400 },
      );
    }
  }
  updateData.avatar_url = avatar_url;
}
```

### SEC-19: Fix video path traversal (MEDIUM)

**File:** `app/api/courses/[courseId]/video-url/route.ts`

Find the path validation (~line 23-24). Add `..` normalization:

```typescript
// BEFORE:
// path checked with startsWith(courseId + "/")

// AFTER — add before the startsWith check:
// Normalize path — strip directory traversal sequences
const normalizedPath = path.replace(/\.\.\//g, "").replace(/\/\.\./g, "");
if (!normalizedPath.startsWith(courseId + "/")) {
  return NextResponse.json({ error: "Invalid video path" }, { status: 400 });
}
// Use normalizedPath instead of path for the storage call
```

### SEC-27: Standardize auth pattern — use getTokenFromHeader (MEDIUM)

These 3 files use manual `headers.get("authorization")` + `replace("Bearer ", "")`. Replace with `getTokenFromHeader`:

**Files:**

- `app/api/me/enrollments/route.ts` (lines 12-17)
- `app/api/courses/[courseId]/chats/route.ts` (lines 36-41)
- `app/api/admin/enrollment-requests/test/route.ts` (lines 12-17)

For each file:

1. Add import: `import { getTokenFromHeader } from "@/lib/admin-auth";`
2. Replace the manual auth header extraction:

```typescript
// BEFORE:
const authHeader = request.headers.get("authorization");
if (!authHeader || !authHeader.startsWith("Bearer ")) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const token = authHeader.replace("Bearer ", "");

// AFTER:
const token = getTokenFromHeader(request);
if (!token) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### SEC-33: Bounds-check pagination parameters (LOW)

**File:** `app/api/notifications/route.ts`

Find pagination parsing (~line 34-36). Add bounds:

```typescript
// AFTER parsing page and limit:
const safePage = Math.max(1, page);
const safeLimit = Math.max(1, Math.min(limit, 100));
// Use safePage and safeLimit instead of page and limit
```

### SEC-34: Validate admin notes length (LOW)

**File:** `app/api/admin/withdrawals/[requestId]/approve/route.ts`

Find where `adminNotes` is used (~line 78-79). Add truncation:

```typescript
// Before passing adminNotes to RPC:
const safeAdminNotes = body.adminNotes?.substring(0, 500) || null;
// Use safeAdminNotes instead of body.adminNotes
```

### SEC-37: Remove stack traces from production console logs (LOW)

**Files:**

- `app/api/admin/enrollment-requests/route.ts` (~line 405)
- `app/api/admin/bundle-enrollment-requests/route.ts` (~line 289)

```typescript
// BEFORE:
console.error("[Admin API ...] Error stack:", error.stack);

// AFTER:
if (process.env.NODE_ENV !== "production") {
  console.error(
    "[Admin API ...] Error stack:",
    error instanceof Error ? error.stack : undefined,
  );
}
```

### SEC-39: Add regex validation to authenticated referral endpoint (LOW)

**File:** `app/api/validate-referral-code/route.ts`

The public endpoint at `app/api/public/validate-referral-code/route.ts` has regex validation (`/^[A-Za-z0-9]{1,20}$/`). Add the same to the authenticated endpoint.

Find the referral code validation section (~line 42-48) and add regex check:

```typescript
// After the length check, add:
if (!/^[A-Za-z0-9]{1,20}$/.test(referralCode)) {
  return NextResponse.json(
    { valid: false, error: "Invalid referral code format" },
    { status: 200 },
  );
}
```

Check if this regex already exists in the file — if so, skip this fix.

## Completion

Run `npm run build`. If it passes, commit with message:

```
fix(security): harden API routes — avatar validation, path traversal, auth standardization

SEC-09: Validate avatar_url against Supabase storage URL pattern
SEC-19: Normalize video paths to prevent directory traversal
SEC-27: Standardize 3 routes to use getTokenFromHeader helper
SEC-33: Bounds-check pagination parameters (max 100 per page)
SEC-34: Truncate admin notes to 500 characters
SEC-37: Remove stack traces from production console output
SEC-39: Add regex validation to authenticated referral endpoint
```

Output DONE when build passes.
