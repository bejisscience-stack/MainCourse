Add UUID validation to all remaining routes that accept UUID parameters. Only touch route files that do NOT already use isValidUUID.

Do NOT touch: app/auth/, next.config.js, middleware.ts, lib/rate-limit.ts, lib/supabase-server.ts, app/api/payments/keepz/callback/route.ts, any files already handled by other agents.

STEP 1 — Find all dynamic route files with [id], [courseId], [requestId], [submissionId], [runId] params that do NOT already import isValidUUID from lib/validation.ts.

STEP 2 — For each found route:
- Import isValidUUID from lib/validation
- After extracting the param, validate it:
  const { id } = await params;
  if (!id || !isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
- This prevents unnecessary database queries with malformed IDs

STEP 3 — Do NOT modify routes that already have UUID validation (check imports first).

Run npm run build. Commit with message "security: consistent UUID validation on all routes (BIZ-06)"
Output <promise>DONE</promise> when build passes.
