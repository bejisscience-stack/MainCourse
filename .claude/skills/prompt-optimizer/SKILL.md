---
name: prompt-optimizer
description: "Auto-detects vague or underspecified prompts and rewrites them with file paths, success criteria, and stack context. Triggers on: optimize prompt, improve prompt, rewrite prompt, make this better, or when user sends ambiguous requests like 'fix X', 'add Y', 'update Z' without file references or acceptance criteria."
---

# Prompt Optimizer Skill

## When to Activate

Detect if the user's prompt has **2 or more** of these signals:
- No file paths or component names mentioned
- No success criteria or expected behavior described
- Ambiguous scope (e.g., "fix the payments", "update the UI", "add notifications")
- Missing stack context (doesn't reference specific tables, APIs, or patterns)
- Uses vague verbs: "fix", "update", "change", "improve", "add" without specifics

**Do NOT activate** when:
- User provides specific file paths or line numbers
- User references exact function/component names
- Request is a question, not an action
- User explicitly says "just do it" or "skip optimization"
- Prompt already contains expected behavior + file references

## Process

1. **Identify intent** — What is the user trying to accomplish? Parse the action verb and target.

2. **Scan codebase** — Use Glob and Grep to find all relevant:
   - Components, pages, API routes (`app/`, `components/`)
   - Hooks, contexts, utilities (`hooks/`, `contexts/`, `lib/`)
   - Database tables, migrations, RPC functions (`supabase/migrations/`)
   - Edge functions (`supabase/functions/`)
   - Locale keys (`locales/en.json`, `locales/ge.json`)

3. **Rewrite prompt** using the 4-element pattern:
   - **File/Location**: Exact paths discovered from scan, with line numbers
   - **Expected behavior**: What it should do after the change
   - **Current behavior**: What it does now (or "new feature" if creating)
   - **Stack context**: Relevant patterns, conventions, related systems in this codebase

4. **Add structure**:
   - Logical task ordering (DB → API → UI)
   - Edge cases that could break
   - Validation criteria (how to verify it works)
   - Abort conditions (when to stop and ask)

5. **Present** the optimized prompt in a fenced code block with a brief explanation of what was found.

6. **Ask**: "Execute this? (yes / edit / ralph N iterations)"
   - If "yes" → execute immediately
   - If "edit" → let user modify, then execute
   - If "ralph N" → wrap in structured ralph prompt and execute with N iterations

## Example

**Raw prompt**: "fix enrollment"

**After optimization**:
```
Fix the enrollment payment flow where students get stuck after Keepz payment.

FILES:
- components/EnrollmentModal.tsx:45-120 — payment iframe and status polling
- app/api/payments/keepz/callback/route.ts — webhook that auto-approves
- app/api/payments/keepz/status/route.ts — polling endpoint with self-healing
- hooks/useEnrollment.ts — enrollment state management

EXPECTED: Payment completes → callback fires → enrollment approved → redirect to /my-courses
CURRENT: [specific issue found in code scan]
CONTEXT: Keepz gateway, enrollment_requests table, approve_enrollment_request() RPC

TASK ORDER: 1) Diagnose callback route 2) Fix status polling 3) Update modal error handling
EDGE CASES: Duplicate callbacks, network timeout during polling, already-enrolled student
VALIDATION: Enrollment shows in /my-courses, enrollment_requests row status = 'approved'
ABORT IF: Migration needed to fix, or >5 files must change
```

## Key Principle

Front-load the codebase research that would happen anyway. A well-specified prompt executes faster and more accurately than a vague one requiring mid-task discovery.
