---
name: prompt-optimizer
description: Auto-detects vague or underspecified prompts and rewrites them with file paths, success criteria, and stack context before execution. Triggers on ambiguous requests like "fix X", "add Y", "update Z" that lack specific file references or acceptance criteria.
---

# Prompt Optimizer Skill

## When to Activate

Detect if the user's prompt has **2 or more** of these signals:
- No file paths or component names mentioned
- No success criteria or expected behavior described
- Ambiguous scope (e.g., "fix the payments", "update the UI", "add notifications")
- Missing stack context (doesn't reference specific tables, APIs, or patterns)

**Do NOT activate** when:
- User provides specific file paths
- User references exact function/component names
- Request is a question, not an action
- User explicitly says "just do it" or "skip optimization"

## Process

1. **Identify intent** — What is the user trying to accomplish?

2. **Scan codebase** — Use Glob and Grep to find all relevant:
   - Components, pages, API routes
   - Hooks, contexts, utilities
   - Database tables, migrations, RPC functions
   - Edge functions
   - Locale keys

3. **Rewrite prompt** using the 4-element pattern:
   - **File/Location**: Exact paths discovered from scan
   - **Expected behavior**: Inferred from intent + codebase context
   - **Current behavior**: What the code does now
   - **Stack context**: Patterns, conventions, related systems

4. **Present** the optimized prompt in a code block with a brief explanation of what you found.

5. **Ask**: "Execute this? (yes / edit / ralph)"

## Example

**Raw prompt**: "fix enrollment"

**After optimization**:
```
Fix the enrollment payment flow where students get stuck after Keepz payment.

FILES:
- components/EnrollmentModal.tsx:45-120 — payment iframe and status polling
- app/api/payments/keepz/callback/route.ts — webhook that auto-approves
- app/api/payments/keepz/status/route.ts — polling endpoint with self-healing

EXPECTED: Payment completes → callback fires → enrollment approved → redirect to /my-courses
CURRENT: [specific issue found in code scan]
CONTEXT: Keepz gateway, enrollment_requests table, approve_enrollment_request() RPC
```

## Key Principle

The goal is to save time by front-loading the codebase research that would happen anyway. A well-specified prompt executes faster and more accurately than a vague one that requires mid-task discovery.
