Migrate rate limiting from in-memory to Upstash Redis. Only touch lib/rate-limit.ts and package.json/package-lock.json.

Do NOT touch any API route files — keep the same exported interface (loginLimiter, paymentLimiter, referralLimiter, passwordResetLimiter, adminLimiter, subscribeLimiter, rateLimitResponse, getClientIP).

STEP 1 — Install Upstash:
- npm install @upstash/ratelimit @upstash/redis

STEP 2 — Rewrite lib/rate-limit.ts:
- Import Ratelimit and Redis from upstash packages
- Create Redis client from environment variables: Redis.fromEnv() which reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
- If env vars are missing (local dev without Redis): fall back to in-memory implementation with a console.warn
- Recreate all existing limiters with same rates using Upstash:
  - loginLimiter: 5 per 60 seconds (slidingWindow)
  - paymentLimiter: 3 per 60 seconds
  - referralLimiter: 10 per 60 seconds
  - passwordResetLimiter: 3 per 900 seconds (15 min)
  - adminLimiter: 30 per 60 seconds
  - subscribeLimiter: 3 per 60 seconds
- Keep the same check(identifier) interface that returns { allowed: boolean, retryAfterMs: number }
- Keep getClientIP function but fix INFRA-04: add a comment documenting that DigitalOcean App Platform overwrites X-Forwarded-For at the load balancer, making spoofing impossible in production
- Keep rateLimitResponse helper function with same signature
- Remove the TODO comment about migrating to Redis

STEP 3 — Add env var documentation:
- Add to .env.example (if it exists, otherwise create):
  UPSTASH_REDIS_REST_URL=# Get from Upstash console
  UPSTASH_REDIS_REST_TOKEN=# Get from Upstash console

Run npm run build. Commit with message "security: migrate rate limiting to Upstash Redis (INFRA-02, INFRA-04)"
Output <promise>DONE</promise> when build passes.
