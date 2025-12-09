# How to Find Your Supabase Project Ref

## What is a Project Ref?

A **project ref** is a unique identifier for your Supabase project. It looks like a short string of letters and numbers (e.g., `abcdefghijklmnop`).

## How to Find It

### Method 1: From Supabase Dashboard URL

1. Go to your Supabase project dashboard
2. Look at the URL in your browser
3. The URL will look like: `https://supabase.com/dashboard/project/abcdefghijklmnop`
4. The part after `/project/` is your **project ref**: `abcdefghijklmnop`

### Method 2: From Project Settings

1. Go to your Supabase dashboard
2. Click on **Settings** (gear icon) in the left sidebar
3. Click on **General** under Project Settings
4. Look for **Reference ID** - this is your project ref

### Method 3: From Environment Variables

If you already have your Supabase URL set up, you can extract it:

Your `NEXT_PUBLIC_SUPABASE_URL` looks like:
```
https://abcdefghijklmnop.supabase.co
```

The part before `.supabase.co` is your **project ref**: `abcdefghijklmnop`

## Installing Supabase CLI

**macOS:**
```bash
brew install supabase/tap/supabase
```

**Other platforms:**
See: https://github.com/supabase/cli#install-the-cli

**Note:** `npm install -g supabase` is NOT supported. Use the official installation methods above.

## Using Project Ref with Supabase CLI

Once you have your project ref, you can link your local project:

```bash
supabase link --project-ref abcdefghijklmnop
```

You'll be prompted to enter your database password (found in Supabase Dashboard > Settings > Database).

## Alternative: Manual Migration (No Project Ref Needed)

If you don't want to use Supabase CLI, you can always:

1. Run `npm run migrate:show` to see the SQL
2. Copy the SQL
3. Paste it into Supabase SQL Editor

No project ref needed for this method!

