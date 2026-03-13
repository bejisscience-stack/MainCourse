Fix 2 issues in app/api/courses/[courseId]/video-url/route.ts ONLY. Do not touch any other file.

FIX 1 — CRITICAL — Video path traversal (DATA-01):
- After the videoPath null check (around line 21), add validation that videoPath starts with the courseId
- Pattern:
  if (!videoPath.startsWith(courseId + '/')) {
    return NextResponse.json({ error: 'Invalid video path' }, { status: 400 });
  }
- This prevents enrolled users from accessing videos from other courses

FIX 2 — LOW — Reduce signed URL duration (DATA-03):
- At line 64, change createSignedUrl expiry from 7200 (2 hours) to 3600 (1 hour)
- Add comment: // 1 hour expiry for paid content protection

Run npm run build. Commit with message "security: fix video path traversal, reduce URL expiry (DATA-01, DATA-03)"
Output <promise>DONE</promise> when build passes.
