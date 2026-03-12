# Swavleba (MainCourse)

## What
Course/learning platform at swavleba.ge. Multi-role (student, lecturer, admin), real-time chat, Keepz payments, bilingual EN/GE.
Stack: Next.js 14 App Router, TypeScript, Supabase (Auth + DB + Realtime + Edge Functions), Tailwind CSS, SWR, Resend, DigitalOcean.

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
supabase/migrations/ # 114+ migrations
supabase/functions/  # 28 Edge Functions (shared code in _shared/)
```

## Workflow Rules
- **Context7 MCP**: Always use `resolve-library-id` -> `query-docs` for library lookups — never rely on training data
- **frontend-design skill**: Use for all UI work (components, pages, layouts, styling)
- **Code review**: Run `/code-review` before merging any PR
- **TypeScript LSP**: Use for type checking when available
- **Prompt optimizer**: Auto-activates on vague prompts — rewrites with file paths and criteria
- **Plan mode**: Use for complex multi-step features before writing code
- **`/improve`**: Run after sessions where mistakes were corrected or new patterns learned

## Conventions
- API auth: `Authorization: Bearer <token>` -> `verifyTokenAndGetUser(token)`
- Supabase: browser = `createBrowserClient()`, server = `createClient()` via cookies
- i18n: support both `en` and `ge` keys in `locales/` via `I18nContext`
- Theme: Charcoal (light) / Navy (dark) / Emerald accents — existing tokens only
- Components: PascalCase files, `'use client'` only when needed, `dynamic()` for heavy imports
- Hooks: `useXxx` pattern, one per file in `hooks/`
- No test framework configured

## Auth Patterns
- **Client-side**: Always try `getSession()` first, fall back to `refreshSession()`, reassign with `let` — never discard refresh result
- **Edge functions**: Use `getAuthenticatedUser(req)` from `_shared/auth.ts` — always pass token explicitly (`persistSession: false`)
- **Imports**: Pin `@supabase/supabase-js` to exact version (`@2.98.0`) in edge functions — unpinned `@2` breaks
- **Deploy**: Always use `verify_jwt: false` when function handles auth internally via `getAuthenticatedUser`

## Deployment
- ALWAYS push to `staging`. Never push to `main` unless explicitly told.
- NEVER affect production Supabase data — no DELETE/UPDATE/TRUNCATE without explicit approval.
- Staging: branch `staging` | Supabase `bvptqdmhuumjbyfnjxdt`
- Production: branch `main` | Supabase `nbecbsbuerdtakxkrduw`
- Full migration/deployment guide: `docs/supabase-guide.md`

## Gotchas
- **Supabase CLI auth**: Store creds in `.env.supabase`, source before CLI — or use Dashboard SQL editor
- **IPv6 psql failures**: Use Dashboard SQL editor (most reliable) or REST API with service role key
- **Edge 401 (no token)**: `getUser()` needs explicit token when `persistSession: false` — use `getUser(token)`
- **esm.sh breaks**: Pin `@supabase/supabase-js@2.98.0` — unpinned `@2` resolves to breaking patches
- **Token refresh discarded**: Use `let session`, reassign `session = refreshed` after `refreshSession()`
- **git commit hangs**: VS Code git conflicts — use `git write-tree` -> `git commit-tree` -> `git update-ref`
- **Edge 401 (verify_jwt)**: Deploy with `verify_jwt: false` when function uses `getAuthenticatedUser(req)`

## Self-Improvement
After every mistake: add to Gotchas as `[Symptom]: [Fix]`, then "Update CLAUDE.md so you don't make this mistake again."
