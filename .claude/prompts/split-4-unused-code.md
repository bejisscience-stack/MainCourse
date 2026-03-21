# Agent 4: Unused Code & Dead Tables Audit

**Output file:** `audit-part3-unused.md` in project root
**Mode:** READ-ONLY audit. Do NOT modify any source code.

## Scope

Search ALL directories and files:

- `app/api/` — API routes
- `components/` — React components
- `hooks/` — Custom hooks
- `lib/` — Utilities
- `supabase/functions/` — Edge functions
- `supabase/migrations/` — Database schema
- `package.json` — Dependencies
- `.env.example` — Environment variables

## What to Check

### 1. Unused Components

For EVERY file in `components/`, search the entire codebase for imports of that component:

```bash
# For each component file, check if it's imported anywhere
grep -rn "ComponentName" --include="*.ts" --include="*.tsx" app/ components/ hooks/
```

List any component with zero imports outside its own file.

### 2. Unused Hooks

For EVERY file in `hooks/`, search for imports:

```bash
grep -rn "useHookName" --include="*.ts" --include="*.tsx" app/ components/ hooks/
```

List any hook with zero imports.

### 3. Unused API Routes

For each route in `app/api/`, search for the API path being called from frontend code:

- Search for the route path string (e.g., `/api/balance`, `/api/admin/payments`)
- Check both `fetch()` calls and any API client functions in `lib/api-client.ts`
- Also check if edge functions call these routes

### 4. Unused Utility Functions

For each exported function in `lib/`, search for its usage across the codebase. List functions with zero callsites.

### 5. Unused npm Packages

Run this check:

```bash
for pkg in $(jq -r '.dependencies | keys[]' package.json); do
  count=$(grep -rn "from.*['\"]$pkg" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" | wc -l)
  if [ "$count" -eq "0" ]; then
    echo "UNUSED: $pkg"
  fi
done
```

Also check `devDependencies` the same way.

### 6. Dead Database Tables

- Read through migration files to find all `CREATE TABLE` statements
- For each table name, search the application code for references:
  - `supabase.from('table_name')`
  - `.rpc('function_name')` calls
  - Edge function SQL queries
- List tables with zero application references

### 7. Dead Database Functions (RPCs)

- Find all `CREATE OR REPLACE FUNCTION` in migrations
- For each, search for `supabase.rpc('function_name')` in application code
- Also check edge functions for direct SQL calls to these functions
- List functions with zero callsites

### 8. Dead Database Columns

For the most important tables (profiles, courses, enrollments, enrollment_requests, withdrawal_requests, notifications, payments), list any columns that are never referenced in application code (not selected, inserted, or updated).

### 9. Commented-Out Code

Search for commented-out code blocks longer than 3 lines:

```bash
grep -rn "^\s*//.*" --include="*.ts" --include="*.tsx"
```

Focus on blocks of 3+ consecutive commented lines that contain actual code (not documentation comments).

### 10. TODO and FIXME Comments

Search for ALL TODO and FIXME comments:

```bash
grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.tsx" --include="*.sql"
```

List each with file path, line number, and content.

### 11. Unused Environment Variables

Check `.env.example` (if it exists) or `.env.local.example`. For each variable, search the codebase for `process.env.VARIABLE_NAME`. List any that are never read.

### 12. Unused Exports

Search for `export` statements in lib/ files and check if they're imported elsewhere. This overlaps with #4 but focuses on individual named exports, not just functions.

## Output Format

Write findings to `audit-part3-unused.md` with this format:

```markdown
# Unused Code & Dead Tables

Found: X unused items (Y components, Z routes, W functions, V packages, U tables, T columns)

## UNUSED-XX: Title

**Type:** component / route / function / package / table / column / export / hook
**Location:** file path or migration
**Last modified:** git log date if discoverable
**Confidence:** high (definitely unused) / medium (might be used dynamically) / low (needs manual verification)
**Safe to remove:** yes / needs verification / no (keep for future use)
```

Number items starting from UNUSED-01. For EACH finding, actually verify it by searching — do not guess. If something might be used via dynamic import or string interpolation, mark confidence as "medium" or "low".

When done, output: DONE — found N unused items.
