# CLAUDE.md — Swavleba (MainCourse)

## Project
Course/learning platform at swavleba.ge. Multi-role (student, lecturer, admin), real-time chat, payments, bilingual EN/GE.
Stack: Next.js 14 App Router, TypeScript, Supabase (Auth + DB + Realtime + Edge Functions), Tailwind CSS, SWR, Resend, DigitalOcean (hosting).

## Commands
```bash
npm run dev          # Start dev (kills port 3000 first)
npm run dev:debug    # Dev with 4GB heap
npm run build        # Production build
npm run lint         # ESLint
npm run dev:clean    # Clean .next and restart
npm run fix          # Full recovery: reinstall + clean dev
npm run migrate      # Run database migrations
```

## Structure
```
app/api/             # API routes — GET/POST/PATCH/DELETE named exports
app/admin/           # Admin dashboard
app/lecturer/        # Lecturer dashboard
app/courses/         # Course pages
app/my-courses/      # Student enrolled courses
components/          # 40+ React components
hooks/               # 39+ custom hooks
contexts/            # I18n, Theme, Background providers
lib/supabase/        # client.ts (browser), server.ts (SSR), middleware.ts
locales/             # en.json, ge.json
supabase/migrations/ # 92+ migrations
supabase/functions/  # 28 Edge Functions (shared code in _shared/)
```

## Conventions
- API auth: `Authorization: Bearer <token>` → `verifyTokenAndGetUser(token)`
- Supabase: browser = `createBrowserClient()`, server = `createClient()` via cookies
- i18n: always support both `en` and `ge` keys in `locales/` via `I18nContext`
- Theme: Charcoal (light) / Navy (dark) / Emerald accents — use existing tokens only
- Components: PascalCase files, `'use client'` only when needed, `dynamic()` for heavy imports
- Hooks: `useXxx` pattern, one per file in `hooks/`
- No test framework configured

## Edge Functions
- **Shared modules** in `supabase/functions/_shared/`: `auth.ts`, `supabase.ts`, `cors.ts`, `email.ts`
- **Auth pattern**: `getAuthenticatedUser(req)` extracts Bearer token and calls `getUser(token)` — always pass token explicitly since `persistSession: false`
- **Dual auth**: Some functions (e.g. `view-scraper`) accept both `x-scraper-secret` header (scheduled runs) and Bearer JWT (manual/admin runs)
- **Imports**: Pin `@supabase/supabase-js` to exact version (`@2.98.0`) in all edge function imports — unpinned `@2` via esm.sh resolves to latest patch which can break behavior
- **Deploy via MCP**: Use `mcp__supabase__deploy_edge_function` — include all files the function imports from `_shared/`
- **Deploy via CLI**: `source .env.supabase && supabase functions deploy <name>`

## Client-Side Auth Pattern
- Always use refresh fallback when getting session for API calls:
  ```typescript
  let { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    session = refreshed;
  }
  if (!session?.access_token) throw new Error('Not authenticated');
  const token = session.access_token;
  ```
- Never discard the result of `refreshSession()` — always assign it back to the `session` variable

## Deployment Rules
- ALWAYS push to `staging` branch. Never push to `main` unless explicitly told.
- ALWAYS target staging Supabase. Never touch production unless explicitly told.
- **NEVER affect data in production Supabase** — no DELETE, UPDATE, TRUNCATE, or any destructive operation on production data, ever.
- Hosting: **DigitalOcean** (not Vercel). Env vars for DB connections are managed there.
- Staging branch: `staging` | Supabase: bvptqdmhuumjbyfnjxdt
- Production branch: `main` | Supabase: nbecbsbuerdtakxkrduw

## Supabase Authentication & Migrations

### Setup (One-time)
Create `.env.supabase` file (NEVER commit — added to .gitignore):
```bash
SUPABASE_DB_PASSWORD=<password>     # Get from Supabase project settings
SUPABASE_DB_HOST=db.bvptqdmhuumjbyfnjxdt.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_USER=postgres
SUPABASE_DB_NAME=postgres
SUPABASE_PROJECT_ID=bvptqdmhuumjbyfnjxdt
SUPABASE_URL=https://bvptqdmhuumjbyfnjxdt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>  # From project settings
```

### Pushing Migrations to Staging
**Option 1: Supabase Dashboard (Always works)**
1. Go to: https://app.supabase.com/project/bvptqdmhuumjbyfnjxdt/sql
2. Click "New Query"
3. Copy migration SQL from `supabase/migrations/[number]_*.sql`
4. Paste and Run

**Option 2: CLI (after .env.supabase setup)**
```bash
source .env.supabase
supabase db push --db-url "postgresql://$SUPABASE_DB_USER:$SUPABASE_DB_PASSWORD@db.$SUPABASE_PROJECT_ID.supabase.co:5432/$SUPABASE_DB_NAME"
```

**Option 3: Direct psql**
```bash
source .env.supabase
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql -h db.bvptqdmhuumjbyfnjxdt.supabase.co -U postgres -d postgres < supabase/migrations/100_*.sql
```

### Deploying Edge Functions
```bash
source .env.supabase
supabase functions deploy <function-name>
```

### Pushing staging → main (safe merge procedure)
When `main` has diverged from `staging` (non-fast-forward), **never force push**. Instead:
```bash
git stash                       # Save any uncommitted work
git checkout main               # Switch to main
git pull origin main            # Pull latest main
git merge staging --no-edit     # Merge staging into main (standard merge)
git push origin main            # Push merged main
git checkout staging            # Switch back to staging
git stash pop                   # Restore uncommitted work
```
This preserves all history on both branches, creates a merge commit, and avoids any destructive operations.

## Self-Improvement
After every mistake I correct, add it to Gotchas before moving on.
Format: `[Symptom]: [Root cause] — [Resolution]`
After every correction end with: "Update CLAUDE.md so you don't make this mistake again."

## Gotchas and Solved Problems

**[Supabase CLI auth barrier]: Cannot push migrations without credentials** — Supabase CLI requires either personal access token or database password. The CLI doesn't work without authentication. — Solution: Store credentials in `.env.supabase` (in .gitignore) and source before running CLI commands, OR use the Supabase dashboard SQL editor for direct SQL execution.

**[IPv6 connectivity to remote DB]: Direct psql connections to db.*.supabase.co fail with IPv6 dial errors** — The CLI tries to connect via IPv6 to the remote database, which may fail on some networks. Network restrictions may block direct PostgreSQL connections. — Solution: Use Supabase dashboard SQL editor instead (most reliable), or use the REST API with service role key.

**[Edge function 401 on all requests]: `getUser()` without token returns null when `persistSession: false`** — The Supabase client in edge functions is created with `persistSession: false`, so `getUser()` can't resolve the token from internal state. Must call `getUser(token)` explicitly. — Fix: `supabase/functions/_shared/auth.ts` line 52, pass the extracted Bearer token to `getUser(token)`.

**[Unpinned esm.sh imports break edge functions]: `@supabase/supabase-js@2` resolves to latest v2 patch** — esm.sh resolves `@2` to whatever the latest 2.x.x release is. A new patch can silently change behavior (e.g. how `getUser()` infers tokens). — Fix: Pin to exact version like `@2.98.0` in all edge function imports and `import_map.json`.

**[Token refresh result discarded]: `refreshSession()` called but refreshed session never used** — Code pattern where `refreshedSession` is obtained but the original expired `session` variable is still used for the token. — Fix: Use `let` for session, reassign `session = refreshed` after refresh, then use `session.access_token`.

**[git commit hangs in VS Code environment]: `git commit` hangs indefinitely** — VS Code's built-in git extension spawns background `git status -z -uall` processes that conflict with CLI git operations. Killing git processes leaves stale `.git/index.lock` files, and VS Code respawns them immediately. — Workaround: Use low-level git commands: `git write-tree` → `git commit-tree <tree> -p <parent>` → `git update-ref`. These bypass the high-level commit machinery that gets stuck. Also use `GIT_OPTIONAL_LOCKS=0` for read-only git operations.

**[Edge function 401 with verify_jwt: true]: `chat-messages` returns 401 while `chat-mute` works with same token** — When deploying edge functions via MCP with `verify_jwt: true`, Supabase's gateway-level JWT validation rejects tokens that the function's own `getUser(token)` would accept. Other functions deployed with `verify_jwt: false` work fine because they bypass the gateway check and handle auth internally. — Fix: Always deploy edge functions with `verify_jwt: false` when the function already uses `getAuthenticatedUser(req)` from `_shared/auth.ts`. The function-level auth is sufficient and more reliable.
