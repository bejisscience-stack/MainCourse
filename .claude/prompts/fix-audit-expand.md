Expand audit logging to sensitive read endpoints. Only touch admin route files that do NOT already have audit logging.

Do NOT touch these files (already have logging or handled by other agents):
- app/api/admin/enrollment-requests/[id]/approve/route.ts
- app/api/admin/enrollment-requests/[id]/reject/route.ts
- app/api/admin/bundle-enrollment-requests/[id]/approve/route.ts
- app/api/admin/bundle-enrollment-requests/[id]/reject/route.ts
- app/api/admin/project-subscriptions/[id]/approve/route.ts
- app/api/admin/project-subscriptions/[id]/reject/route.ts
- app/api/admin/withdrawals/[requestId]/approve/route.ts
- app/api/admin/withdrawals/[requestId]/reject/route.ts
- app/api/admin/notifications/send/route.ts
- app/api/admin/view-scraper/run/route.ts
- app/api/admin/view-scraper/schedule/route.ts
- app/api/payments/keepz/callback/route.ts
- lib/rate-limit.ts, lib/supabase-server.ts, middleware.ts, next.config.js

Add audit logging to these routes that access sensitive financial/user data:
- app/api/admin/withdrawals/route.ts (GET — logs who viewed withdrawal requests)
- app/api/admin/enrollments/route.ts (any POST/PATCH/DELETE handlers)

For each:
- Import logAdminAction from lib/audit-log.ts
- After successful response is prepared, log the access
- For GET routes use action like "view_withdrawals" with metadata { count: data.length }
- Wrap in try/catch so logging failures never break the main operation
- Pattern: try { await logAdminAction(request, adminId, 'view_withdrawals', 'withdrawal_requests', 'list', { count: data?.length }); } catch (e) { console.error('[Audit] Log failed:', e); }

Run npm run build. Commit with message "security: expand audit logging to financial routes (BIZ-01)"
Output <promise>DONE</promise> when build passes.
