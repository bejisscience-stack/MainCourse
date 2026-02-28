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
supabase/functions/  # 31 Edge Functions
```

## Conventions
- API auth: `Authorization: Bearer <token>` → `verifyTokenAndGetUser(token)`
- Supabase: browser = `createBrowserClient()`, server = `createClient()` via cookies
- i18n: always support both `en` and `ge` keys in `locales/` via `I18nContext`
- Theme: Charcoal (light) / Navy (dark) / Emerald accents — use existing tokens only
- Components: PascalCase files, `'use client'` only when needed, `dynamic()` for heavy imports
- Hooks: `useXxx` pattern, one per file in `hooks/`
- No test framework configured

## Deployment Rules
- ALWAYS push to `staging` branch. Never push to `main` unless explicitly told.
- ALWAYS target staging Supabase. Never touch production unless explicitly told.
- **NEVER affect data in production Supabase** — no DELETE, UPDATE, TRUNCATE, or any destructive operation on production data, ever.
- Hosting: **DigitalOcean** (not Vercel). Env vars for DB connections are managed there.
- Staging branch: `staging` | Supabase: bvptqdmhuumjbyfnjxdt
- Production branch: `main` | Supabase: nbecbsbuerdtakxkrduw

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
<!-- Claude appends here after each hard-won fix -->