# Swavleba (MainCourse)

## What
Course/learning platform at swavleba.ge. Multi-role (student, lecturer, admin), real-time chat, Keepz payments, bilingual EN/GE.
Stack: Next.js 14 App Router, TypeScript 5.3, Supabase (Auth + DB + Realtime + Edge Functions), Tailwind CSS 3.4, SWR 2, Resend, DigitalOcean.

Key dirs: `app/api/` (routes), `components/` (40+), `hooks/` (39+), `contexts/` (I18n/Theme/Background), `lib/supabase/` (client/server), `supabase/migrations/` (114+), `supabase/functions/` (28 edge fns).

## Why
Georgian-language education platform serving real students. Supabase chosen for auth + realtime + edge in one platform. Next.js 14 for SSR + API routes. SWR for client-side data fetching with caching.

## How

### Commands
`npm run dev` (start), `npm run build` (prod), `npm run lint` (ESLint), `npm run migrate` (DB), `npm run fix` (full recovery)

### Deployment
- Push to `staging` only. Never push to `main` without explicit approval.
- Staging: branch `staging` | Supabase `bvptqdmhuumjbyfnjxdt`
- Production: branch `main` | Supabase `nbecbsbuerdtakxkrduw`

### Conventions
- API auth: `Authorization: Bearer <token>` → `verifyTokenAndGetUser(token)`
- Supabase: browser = `createBrowserClient()`, server = `createClient()` via cookies
- i18n: both `en` and `ge` keys in `locales/` via `I18nContext`
- Theme: Charcoal (light) / Navy (dark) / Emerald accents — existing tokens only
- Components: PascalCase, `'use client'` only when needed, `dynamic()` for heavy imports
- Hooks: `useXxx` pattern, one per file in `hooks/`

### Workflow Rules
- When prompt is vague → use prompt-optimizer skill before executing
- Use Plan mode (Shift+Tab) for complex multi-step features before implementing
- Run `/improve` after sessions where mistakes were corrected or new patterns learned
- After every correction: "Should I update CLAUDE.md?"
- Use `/clear` between unrelated tasks; `/compact` at ~50% context usage
- No test framework configured — validate manually

### Auth Patterns
- **Client**: `getSession()` first → fall back to `refreshSession()` → reassign with `let`
- **Edge functions**: `getAuthenticatedUser(req)` from `_shared/auth.ts` — pass token explicitly
- **Imports**: Pin `@supabase/supabase-js@2.98.0` in edge functions — unpinned `@2` breaks
- **Deploy**: `verify_jwt: false` when function handles auth via `getAuthenticatedUser`

### Gotchas
- **Supabase CLI auth**: Store creds in `.env.supabase`, source before CLI — or use Dashboard SQL editor
- **IPv6 psql failures**: Use Dashboard SQL editor (most reliable) or REST API
- **esm.sh breaks**: Pin `@supabase/supabase-js@2.98.0`
- **Token refresh discarded**: Use `let session`, reassign after `refreshSession()`
- **git commit hangs**: VS Code conflict — use `git write-tree` → `git commit-tree` → `git update-ref`

### Detailed Docs
- Keepz payment integration: `docs/keepz-api-guide.md`
- Supabase migrations & deployment: `docs/supabase-guide.md`
