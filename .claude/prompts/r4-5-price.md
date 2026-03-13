Fix 1 issue in app/api/payments/keepz/create-order/route.ts ONLY. Do not touch any other file.

FIX — MEDIUM — Hardcoded project subscription price (PAY-03):
- At line 107 where amount is hardcoded to 10.0
- Replace with a dynamic price fetch from the database or environment variable
- Option A (preferred): Fetch price from a config table or the project_subscriptions record
  - Check if project_subscriptions table has a price or amount column
  - If yes: use that value instead of 10.0
  - If no: check if there is a pricing config table
- Option B (fallback): Use environment variable
  - const amount = Number(process.env.PROJECT_SUBSCRIPTION_PRICE || '10.0');
  - Add to .env.example: PROJECT_SUBSCRIPTION_PRICE=10.0
- Whichever option you choose, add a comment explaining where the price comes from
- IMPORTANT: Do NOT change any other logic in this file

Run npm run build. Commit with message "security: dynamic project subscription pricing (PAY-03)"
Output <promise>DONE</promise> when build passes.
