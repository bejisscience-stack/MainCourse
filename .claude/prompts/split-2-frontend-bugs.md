# Agent 2: Frontend Bugs & Logic Errors

**Output file:** `audit-part1b-frontend-bugs.md` in project root
**Mode:** READ-ONLY audit. Do NOT modify any source code.

## Scope

Search for actual bugs in these directories ONLY:

- `components/` (69 component files)
- `hooks/` (49 hook files)
- `contexts/` (I18n, Theme, Background contexts)
- `app/` page files (not `app/api/`)

## What to Check

### 1. State Desync in React Components

- Find every `useEffect` — check if dependency arrays are complete
- Look for stale closures: state read inside callbacks that don't have the state in deps
- Check `useChatMessages.ts` (513 lines) and `useRealtimeMessages.ts` (477 lines) — these are complex state managers, likely candidates for bugs
- Look for `useState` + `useEffect` patterns where the effect doesn't clean up subscriptions

### 2. Null/Undefined Crashes in Components

- Check every component that renders data from hooks — what if the data is null/loading?
- Look for `data.map()` without checking if data exists first
- Check conditional rendering: are there components that crash instead of showing a loading state?
- Search for `.length` access on potentially undefined arrays

### 3. Realtime Subscription Leaks

- Check all `useRealtime*.ts` hooks — do they properly unsubscribe on unmount?
- Look for `supabase.channel()` calls without corresponding `removeChannel()` in cleanup
- Check if multiple subscriptions can stack up on re-render

### 4. Missing Error Boundaries

- Which components would crash the entire page if one API call fails?
- Is `ChatErrorBoundary.tsx` the only error boundary? What pages lack one?
- Check if error states are handled in every data-fetching hook

### 5. Race Conditions in UI

- Rapid button clicks: can enrollment/payment be submitted twice?
- Search for `isLoading` or `isSubmitting` guards on form submissions
- Check if optimistic updates can desync with server state
- Look at `PaymentDialog.tsx` (487 lines) — payment flow race conditions

### 6. useEffect Dependency Issues

- Search for `// eslint-disable-next-line react-hooks/exhaustive-deps` — each one is suspicious
- Find effects with empty `[]` deps that reference state or props
- Check hooks that call `mutate()` or `revalidate()` — do they cause infinite loops?

### 7. Incorrect Type Usage

- Search for `as any` in all component and hook files
- Look for type assertions on event handlers, ref objects, API responses
- Check if SWR hooks have proper type parameters

### 8. God Components (>500 lines)

Known large files to audit carefully:

- `LecturesChannel.tsx` (1637 lines)
- `ProjectCard.tsx` (1523 lines — chat version)
- `AdminNotificationSender.tsx` (1228 lines)
- `VideoUploadDialog.tsx` (1149 lines)
- `Message.tsx` (1065 lines)
- `ChatArea.tsx` (1057 lines)
- `EnrollmentModal.tsx` (991 lines)
- `MessageInput.tsx` (984 lines)

Check these for: multiple responsibilities, deeply nested JSX, duplicated logic within the file.

## Output Format

Write findings to `audit-part1b-frontend-bugs.md` with this format:

```markdown
# Frontend Bugs & Logic Errors

Found: X bugs (Y crash, Z wrong behavior, W cosmetic)

## BUG-XX: Title

**File:** path:line
**Severity:** crash / data corruption / wrong behavior / cosmetic
**Evidence:** code snippet showing the bug
**Trigger:** specific steps or conditions to reproduce
**Impact:** what goes wrong for the user
```

Number bugs starting from BUG-50 (to avoid collision with Agent 1). Be thorough — read every file in scope. Only report REAL bugs with evidence, not style preferences.

When done, output: DONE — found N bugs in frontend code.
