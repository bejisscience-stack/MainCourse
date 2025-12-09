# Quick Start Guide

## Your Supabase Project Ref
**Project Ref:** `nbecbsbuerdtakxkrduw`

## Running Migrations

### Option 1: Manual (Easiest - No Setup Required)
```bash
npm run migrate:show
```
Copy the SQL output and paste it into Supabase SQL Editor.

### Option 2: Using Supabase CLI (Automated)

1. **Install Supabase CLI (macOS):**
   ```bash
   brew install supabase/tap/supabase
   ```
   
   Or if you don't have Homebrew, install it first:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   brew install supabase/tap/supabase
   ```

2. **Link your project:**
   ```bash
   supabase link --project-ref nbecbsbuerdtakxkrduw
   ```
   You'll be prompted for your database password (found in Supabase Dashboard > Settings > Database).

3. **Run migrations:**
   ```bash
   supabase db push
   ```

## Environment Variables

Make sure your `.env.local` file has:
```env
NEXT_PUBLIC_SUPABASE_URL=https://nbecbsbuerdtakxkrduw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

## Next Steps

1. Run migrations (choose one method above)
2. (Optional) Seed sample courses:
   - Copy contents of `supabase/seed-courses.sql`
   - Paste into Supabase SQL Editor and run
3. Start your development server:
   ```bash
   npm run dev
   ```

## Useful Commands

- `npm run migrate` - Interactive migration runner
- `npm run migrate:show` - Display SQL for manual copying
- `npm run dev` - Start development server

