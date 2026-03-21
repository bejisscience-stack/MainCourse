# Agent 1: Backend Bugs & Logic Errors

**Output file:** `audit-part1a-backend-bugs.md` in project root
**Mode:** READ-ONLY audit. Do NOT modify any source code.

## Scope

Search for actual bugs in these directories ONLY:

- `app/api/` (52 route files)
- `supabase/functions/` (28 edge functions + `_shared/`)
- `lib/` (26 utility files)

## What to Check

### 1. Race Conditions

- Look for read-then-write patterns across multiple `await` calls without transactions or `FOR UPDATE`
- Payment callbacks: what happens if two callbacks arrive simultaneously for the same order?
- Enrollment approval: can two admins approve the same request at the same time?
- Balance operations: read balance → check → deduct — is this atomic?
- Check every file in `app/api/payments/` and `app/api/admin/withdrawals/`

### 2. Null/Undefined Crashes

- Check EVERY `.data` access after a Supabase query — is `.error` checked first?
- Check every destructuring like `const { data } = await supabase...` — what if data is null?
- Look for `data.something` without null checks
- Check edge functions in `supabase/functions/` for the same pattern

### 3. Missing Await

- Search for async function calls without `await`
- Search for `.then(` patterns that should be awaited
- Look for fire-and-forget patterns in API routes (email sending, logging, etc.)

### 4. Error Swallowing

- Find every `catch` block in API routes and edge functions
- Check if they return proper HTTP error responses or silently swallow
- Find `catch(e) { console.log... }` patterns with no re-throw

### 5. Business Logic Edge Cases

- **Balance exactly 0:** What happens when withdrawal is requested with 0 balance?
- **Self-referral:** Can a user use their own referral code? Check `validate-referral-code`
- **Double enrollment:** Can the same user enroll twice in the same course?
- **Payment after manual approval:** What if Keepz callback arrives after admin already approved enrollment?
- **Expired project access:** What happens at the boundary of `project_access_expires_at`?

### 6. Auth & Security Bugs

- Check every API route: does it verify the auth token before doing anything?
- Check admin routes: do they verify admin role, not just auth?
- Check for IDOR: can a user access another user's data by changing an ID in the request?
- Look at `lib/auth.ts`, `lib/admin-auth.ts` for bypasses

### 7. Type Safety Issues

- Search for `as any` in all backend files
- Search for type assertions that could be wrong at runtime
- Check if Zod schemas in `lib/schemas/` match what the DB actually returns

## Output Format

Write findings to `audit-part1a-backend-bugs.md` with this format:

```markdown
# Backend Bugs & Logic Errors

Found: X bugs (Y crash, Z data corruption, W wrong behavior, V cosmetic)

## BUG-XX: Title

**File:** path:line
**Severity:** crash / data corruption / wrong behavior / cosmetic
**Evidence:** code snippet showing the bug
**Trigger:** specific steps or conditions to reproduce
**Impact:** what goes wrong for the user
```

Number bugs starting from BUG-01. Be thorough — read every file in scope. Don't guess, verify by reading the actual code. Only report REAL bugs, not style preferences.

When done, output: DONE — found N bugs in backend code.
