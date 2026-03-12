# Security Patterns — Swavleba

## Auth Flow

### Client-side (browser)

1. `getSession()` first — returns cached session if valid
2. Fall back to `refreshSession()` if expired
3. Use `let session` (not `const`) — reassign after refresh
4. Client created via `createBrowserClient()` from `lib/supabase/client.ts`

### Server-side (API routes)

1. Extract token from `Authorization: Bearer <token>` header
2. Verify with `verifyTokenAndGetUser(token)` — returns user or throws
3. Never trust client-supplied user IDs — always derive from verified token
4. Server client created via `createClient()` from `lib/supabase/server.ts` (uses cookies)

### Edge Functions (Supabase)

1. Use `getAuthenticatedUser(req)` from `_shared/auth.ts`
2. Pass token explicitly — do not rely on cookie forwarding
3. Set `verify_jwt: false` when function handles auth internally
4. Pin `@supabase/supabase-js@2.98.0` — unpinned `@2` breaks on esm.sh

## RLS Conventions

- Every user-facing table **must** have RLS enabled
- Standard policy pattern:
  - `SELECT`: user can read own rows (`auth.uid() = user_id`)
  - `INSERT`: user can insert own rows (`WITH CHECK (auth.uid() = user_id)`)
  - `UPDATE`: user can update own rows (`USING (auth.uid() = user_id)`)
  - `DELETE`: rarely allowed; prefer soft-delete or admin-only
- Admin override policies check `profiles.role = 'admin'`
- `SECURITY DEFINER` functions bypass RLS — use sparingly, validate inputs
- Service role key bypasses RLS entirely — never expose to client

## API Route Security Checklist

When creating a new API route (`app/api/.../route.ts`):

- [ ] Extract and verify Bearer token with `verifyTokenAndGetUser()`
- [ ] Return 401 for missing/invalid tokens
- [ ] Validate all request body fields (type, range, format)
- [ ] Use parameterized queries — never interpolate user input into SQL
- [ ] Check user authorization (role, ownership) before mutations
- [ ] Return minimal data — select explicit columns, not `SELECT *` or bare `.select()`
- [ ] Validate UUID format on route parameters before database queries
- [ ] Set appropriate HTTP status codes (400 for bad input, 403 for unauthorized)
- [ ] Return generic error messages to clients — log details server-side only
- [ ] Never log PII (emails, names) in production console statements
- [ ] Validate redirect URLs with `validateRedirectUrl()` — only allow relative paths

## Payment Security (Keepz)

- **Encrypted callbacks only**: Plaintext callbacks are rejected. Keepz sends `encryptedData` + `encryptedKeys` which are decrypted with our RSA private key. Successful decryption = authentic payload.
- **Amount validation**: Callback amount is verified against the stored `keepz_payments` record
- **No user UPDATE policy**: Users cannot modify their own payment records. Only the `complete_keepz_payment` SECURITY DEFINER RPC can update payment status.
- Payment status transitions: `pending` → `completed` or `pending` → `failed` only
- Callback route (`/api/payments/keepz/callback`) is public — always returns 200 (Keepz expects this)
- See `docs/keepz-api-guide.md` for full integration details

## Environment Variables

- All secrets stored in `.env.local` (gitignored)
- Staging credentials in `.env.supabase` (gitignored)
- Never hardcode keys, tokens, or connection strings in source
- Required env vars:
  - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client-safe
  - `SUPABASE_SERVICE_ROLE_KEY` — server-only, never exposed to browser
  - `KEEPZ_API_KEY` / `KEEPZ_SECRET_KEY` — server-only
  - `RESEND_API_KEY` — server-only
  - `TEAM_ACCESS_KEY` — server-only, used in middleware

## New Protected Route Template

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyTokenAndGetUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  // 1. Authenticate
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyTokenAndGetUser(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // 2. Authorize (example: check role)
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Execute query with explicit columns
  const { data, error } = await supabase
    .from("your_table")
    .select("id, name, created_at")
    .eq("user_id", user.id);

  if (error) {
    console.error("Query error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  return NextResponse.json({ data });
}
```

## Known Vulnerabilities (Require Major Version Bumps)

| Package | Current | Fix Version | Severity | Advisory                                                                                          |
| ------- | ------- | ----------- | -------- | ------------------------------------------------------------------------------------------------- |
| next    | 14.x    | 16.x+       | high     | GHSA-9g9p-9gw9-jx7f (DoS via Image Optimizer), GHSA-h25m-26qc-wcjf (HTTP request deserialization) |

**Note:** Upgrading Next.js from 14 to 16 is a breaking change requiring a dedicated migration effort. Do not run `npm audit fix --force`.
