Fix 4 security items. Each touches a DIFFERENT file — no conflicts.

1. DELETE app/api/admin/debug-requests/route.ts entirely (API-01 CRITICAL — leaks DB structure to unauthenticated users)

2. DELETE app/api/admin/enrollment-requests/test/route.ts entirely (API-02 CRITICAL — exposes RPC debug results in production)

3. EDIT middleware.ts line 22: replace === comparison with timing-safe comparison for team access key. Use crypto.timingSafeEqual with Buffer.from() on both sides. Import crypto at top of file.

4. EDIT lib/rate-limit.ts: add comment at top of file: "// TODO: In-memory store resets on deploy. Migrate to Upstash Redis when scaling to multiple instances. See SECURITY_AUDIT.md RL-01"

Run npm run build after all changes. Commit with message "security: remove debug endpoints, timing-safe middleware (API-01, API-02, MW-01, RL-01)"

Output <promise>DONE</promise> when build passes.
