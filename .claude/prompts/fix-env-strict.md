Fix service role client silent fallback. Only touch lib/supabase-server.ts.

FIX — MEDIUM — Strict service role client (ENV-02):
- In the createServiceRoleClient function (lines 24-46):
  - In production (process.env.NODE_ENV === 'production'): throw an error if SUPABASE_SERVICE_ROLE_KEY is not set
  - In development: keep the existing fallback behavior with console.warn
  - Pattern:
    if (!supabaseServiceRoleKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: SUPABASE_SERVICE_ROLE_KEY is required in production. Service role operations will fail without it.');
      }
      // Development fallback...
      console.warn('SUPABASE_SERVICE_ROLE_KEY not set. Falling back to user token (dev mode)...');
      // ... existing fallback code
    }
- This ensures production deployments fail fast and visibly if the env var is missing, instead of silently degrading

Run npm run build. Commit with message "security: strict service role client in production (ENV-02)"
Output <promise>DONE</promise> when build passes.
