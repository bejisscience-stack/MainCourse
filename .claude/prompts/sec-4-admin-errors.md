Sanitize error responses in admin, notification, withdrawal, and project-subscription routes ONLY. 

Do NOT touch these files (another instance handles them):
- app/api/enrollment-requests/route.ts
- app/api/bundle-enrollment-requests/route.ts
- app/api/complete-profile/route.ts
- app/api/payments/keepz/create-order/route.ts
- app/api/payments/keepz/callback/route.ts
- middleware.ts
- next.config.js
- lib/rate-limit.ts

In every file listed below, find all instances of error.message or error.code being returned in JSON responses and replace with generic messages. Pattern: console.error the real error server-side, return "An error occurred" to client.

Files to fix:
- app/api/project-subscriptions/route.ts
- app/api/notifications/unread-count/route.ts
- app/api/notifications/[id]/read/route.ts
- app/api/notifications/route.ts
- app/api/notifications/read-all/route.ts
- app/api/admin/enrollment-requests/[id]/approve/route.ts
- app/api/admin/enrollment-requests/[id]/reject/route.ts
- app/api/admin/enrollments/route.ts
- app/api/admin/withdrawals/route.ts
- app/api/admin/withdrawals/[requestId]/approve/route.ts
- app/api/admin/withdrawals/[requestId]/reject/route.ts
- app/api/admin/bundle-enrollment-requests/[id]/approve/route.ts
- app/api/admin/bundle-enrollment-requests/[id]/reject/route.ts
- app/api/admin/bundle-enrollment-requests/route.ts
- app/api/admin/notifications/send/route.ts
- app/api/admin/project-subscriptions/[id]/approve/route.ts
- app/api/admin/project-subscriptions/[id]/reject/route.ts
- All app/api/admin/view-scraper/*/route.ts files

Also remove any console.log that contains user emails or PII in these files. Replace with user ID references only.

Run npm run build after all changes. Commit with message "security: sanitize admin error responses (API-04, INF-03)"

Output <promise>DONE</promise> when build passes.
