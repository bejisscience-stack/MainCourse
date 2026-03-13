Fix 2 LOW issues in lib/rate-limit.ts and next.config.js ONLY. Do not touch any other files.

FIX 1 — LOW — Rate limiting fallback documentation (RATE-01):
- In lib/rate-limit.ts at the top where the Redis check happens (around line 6-15)
- Update the warning message to be more explicit:
  console.warn('[Rate Limit] WARNING: Upstash Redis not configured. Using in-memory fallback. Rate limits reset on deploy and are per-instance. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for persistent rate limiting.');
- Add a comment documenting the production requirement:
  // PRODUCTION REQUIREMENT: Ensure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
  // Without Redis, rate limiting is ephemeral and can be bypassed by waiting for deploys.

FIX 2 — LOW — SVG sanitization documentation (CSP-02):
- In next.config.js at the dangerouslyAllowSVG line (around line 19)
- Verify the existing security comment is present and accurate
- If the comment mentions "user-uploaded SVGs should be sanitized", add additional detail:
  // Current SVG sources: admin-uploaded course thumbnails and platform assets only.
  // No user-uploaded SVGs are accepted. If user SVG uploads are added in the future,
  // implement DOMPurify sanitization in the upload handler before storage.
- Do NOT change any configuration values

Run npm run build. Commit with message "security: document rate limit fallback and SVG policy (RATE-01, CSP-02)"
Output <promise>DONE</promise> when build passes.
