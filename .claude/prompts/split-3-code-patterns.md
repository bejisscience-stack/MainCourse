# Agent 3: Bad Code Patterns Audit

**Output file:** `audit-part2-patterns.md` in project root
**Mode:** READ-ONLY audit. Do NOT modify any source code.

## Scope

Search ALL directories:

- `app/api/` — API routes
- `components/` — React components
- `hooks/` — Custom hooks
- `lib/` — Utilities
- `supabase/functions/` — Edge functions

## What to Check

### 1. Duplicated Logic

Search for the same business rule implemented in multiple places:

- **Admin verification:** How many different files check if a user is admin? Search for patterns like `role === 'admin'`, `is_admin`, `verifyAdmin`. List every occurrence.
- **Auth token extraction:** How many different ways does the codebase extract Bearer tokens? grep for `Authorization`, `Bearer`, `getSession`.
- **Balance checks:** Where is balance validated? Is the logic identical everywhere?
- **Enrollment validation:** How many files check enrollment status? Do they all check the same conditions?
- **Error response formatting:** Are error responses consistent? Search for `NextResponse.json` with error status codes — list the different formats used.
- **Supabase client creation:** How many different ways is the Supabase client created? Count patterns.

### 2. God Files (>500 lines)

List EVERY file over 500 lines with exact line count. Known candidates:

- LecturesChannel.tsx (1637), chat/ProjectCard.tsx (1523), AdminNotificationSender.tsx (1228)
- VideoUploadDialog.tsx (1149), Message.tsx (1065), ChatArea.tsx (1057)
- EnrollmentModal.tsx (991), MessageInput.tsx (984), ProjectSubscriptionModal.tsx (839)
- Navigation.tsx (807), and more...

For each, note what multiple responsibilities it has.

### 3. Deeply Nested Conditionals

Search for if/else chains deeper than 3 levels. Read the largest files and check for nesting.

### 4. Magic Numbers and Hardcoded Strings

- Search for hardcoded prices, limits, timeouts, URLs
- grep for numeric literals in business logic (not array indices or 0/1)
- grep for hardcoded domain names, API URLs, bucket names
- Search for string literals used as status values in multiple places

### 5. Inconsistent Patterns

- **Error handling:** Do all API routes handle errors the same way? Compare 5+ routes.
- **Response format:** Is there a consistent API response shape or does each route differ?
- **Auth patterns:** Client auth vs server auth vs edge function auth — list the different approaches.
- **Data fetching:** SWR vs direct fetch vs Supabase client — where is each used and is it consistent?
- **Date handling:** How are dates formatted? Is timezone handling consistent?

### 6. Dead Parameters

Search for function parameters that are accepted but never used within the function body. Focus on exported functions and component props.

### 7. Complex Functions (>50 lines)

Find functions longer than 50 lines. For each, note if it does more than one thing.

### 8. N+1 Query Patterns

Look for loops that make individual database calls instead of batching:

- `for` or `forEach` loops containing `await supabase.from(...)`
- `.map()` with async callbacks that each make a DB query

### 9. Prop Drilling

Find props passed through 3+ component levels. Look at the chat components especially — the LayoutContainer → ChatArea → Message chain.

### 10. Hardcoded Environment Assumptions

Search for hardcoded localhost, staging URLs, or production URLs. Check for `process.env.NODE_ENV` vs hardcoded checks.

## Output Format

Write findings to `audit-part2-patterns.md` with this format:

```markdown
# Bad Code Patterns

Found: X patterns (Y duplication, Z complexity, W inconsistency, V performance, U maintainability)

## CODE-XX: Title

**File:** path:line
**Category:** duplication / complexity / inconsistency / performance / maintainability
**Evidence:** code snippet or pattern description
**Why it matters:** concrete consequence of keeping this pattern
**Suggested approach:** brief description of better pattern (do not implement)
```

Number patterns starting from CODE-01. Be thorough and specific — show actual code evidence for each finding.

When done, output: DONE — found N bad code patterns.
