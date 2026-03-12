# Supabase Operations Guide — Swavleba

## Environment Setup (One-time)

Create `.env.supabase` (NEVER commit — in .gitignore):
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

## Pushing Migrations to Staging

**Option 1: Dashboard (most reliable)**
1. Go to: https://app.supabase.com/project/bvptqdmhuumjbyfnjxdt/sql
2. New Query → paste migration SQL → Run

**Option 2: CLI**
```bash
source .env.supabase
supabase db push --db-url "postgresql://$SUPABASE_DB_USER:$SUPABASE_DB_PASSWORD@db.$SUPABASE_PROJECT_ID.supabase.co:5432/$SUPABASE_DB_NAME"
```

**Option 3: Direct psql**
```bash
source .env.supabase
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql -h db.bvptqdmhuumjbyfnjxdt.supabase.co -U postgres -d postgres < supabase/migrations/NNN_*.sql
```

## Production Migrations
Use `mcp__supabase__execute_sql` with `project_id: nbecbsbuerdtakxkrduw`

## Deploying Edge Functions

**Via CLI:**
```bash
source .env.supabase
supabase functions deploy <function-name>
```

**Via MCP** (`mcp__supabase__deploy_edge_function`):
- `entrypoint_path`: `supabase/functions/<name>/index.ts`
- `import_map_path`: `supabase/functions/import_map.json`
- All shared files: `supabase/functions/_shared/auth.ts`, etc.
- New functions (never deployed via CLI) work with flat paths (`index.ts`)
- Always deploy with `verify_jwt: false` when function uses `getAuthenticatedUser(req)`

## Staging -> Main (Safe Merge)

Never force push. Use standard merge:
```bash
git stash                       # Save uncommitted work
git checkout main
git pull origin main
git merge staging --no-edit
git push origin main
git checkout staging
git stash pop
```

## Supabase Account Mapping
- **Production** (`nbecbsbuerdtakxkrduw`): `bejisscience@gmail.com` / bejisscience-stack's Org
- **Staging** (`bvptqdmhuumjbyfnjxdt`): same org
- **CLI auth**: Use `supabase login --token <token>` (browser flow picks wrong account)
- **CLI deploy**: Use `--project-ref` flag regardless of org shown
