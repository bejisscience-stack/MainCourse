Fix 3 security items in Supabase layer only. Do NOT touch any files in app/api/ EXCEPT app/api/payments/keepz/callback/route.ts.

1. Private payment-screenshots bucket (INF-01):
- Create new Supabase migration: SET public = false for payment-screenshots bucket
- Drop public SELECT policy on payment-screenshots
- Create new policy: admins can SELECT all, authenticated users can SELECT only their own uploads
- Find ALL components that display payment screenshots and update them to use Supabase signed URLs with 1 hour expiry
- Check course-videos bucket: if video URLs are guessable, document it. Do NOT change course-videos in this task.

2. Timing-safe edge function auth (EDGE-01 LOW):
- In supabase/functions/view-scraper/index.ts line 123: replace === with timing-safe comparison
- Use crypto.subtle.timingSafeEqual() with TextEncoder for both strings
- Wrap in try-catch in case lengths differ (timingSafeEqual requires same length)

3. Keepz callback IP documentation (PAY-01 LOW):
- In app/api/payments/keepz/callback/route.ts: add a comment at the top of the POST handler:
  // TODO: Add Keepz IP whitelist when they publish static IPs. Currently relying on encrypted payload verification only. See SECURITY_AUDIT.md PAY-01
- Do NOT modify any logic in this file, only add the comment

Run npm run build after changes. Commit with message "security: private buckets, timing-safe edge auth (INF-01, EDGE-01, PAY-01)"

Output <promise>DONE</promise> when build passes.
