Expand audit logging coverage across admin routes (BIZ-01). 

The logAdminAction utility already exists at lib/audit-log.ts and is already integrated in 8 routes. Add it to ALL remaining admin routes that perform state-changing operations.

Do NOT touch any files that the other prompts handle:
- Do NOT touch app/api/validate-referral-code/route.ts
- Do NOT touch app/api/coming-soon/subscribe/route.ts  
- Do NOT touch app/api/profile/route.ts
- Do NOT touch app/api/health/route.ts
- Do NOT touch middleware.ts
- Do NOT touch next.config.js
- Do NOT touch any supabase/functions/ files
- Do NOT touch any supabase/migrations/ files

Routes that ALREADY have audit logging (verify but do not modify):
- app/api/admin/enrollment-requests/[id]/approve/route.ts
- app/api/admin/enrollment-requests/[id]/reject/route.ts
- app/api/admin/project-subscriptions/[id]/approve/route.ts
- app/api/admin/project-subscriptions/[id]/reject/route.ts
- app/api/admin/withdrawals/[requestId]/approve/route.ts
- app/api/admin/withdrawals/[requestId]/reject/route.ts
- app/api/admin/bundle-enrollment-requests/[id]/approve/route.ts
- app/api/admin/bundle-enrollment-requests/[id]/reject/route.ts

Routes that NEED audit logging added:
- app/api/admin/enrollments/route.ts (any POST/PATCH/DELETE operations)
- app/api/admin/notifications/send/route.ts (log notification sends with recipient count)
- app/api/admin/view-scraper/run/route.ts (log manual scraper runs)
- app/api/admin/view-scraper/schedule/route.ts (log schedule changes)

For each route:
- Import logAdminAction from lib/audit-log.ts
- After the successful operation (not before), call logAdminAction with:
  - request: the NextRequest object
  - adminUserId: the verified admin user ID
  - action: descriptive string like "send_notification", "run_scraper", "update_schedule"
  - targetTable: the primary table being modified
  - targetId: the ID of the record being modified (or "bulk" for bulk operations)
  - metadata: any relevant context (e.g., { recipientCount: 5, notificationType: "announcement" })
- Do NOT let audit logging failures break the main operation — wrap in try/catch
- Pattern: try { await logAdminAction(request, adminId, 'action', 'table', targetId, { key: value }); } catch (e) { console.error('[Audit] Failed to log:', e); }

Run npm run build after all changes. Commit with message "security: expand audit logging to all admin operations (BIZ-01)"

Output <promise>DONE</promise> when build passes.
