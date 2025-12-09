# Migration Scripts

This directory contains scripts to help you run database migrations from the terminal.

## Available Scripts

### 1. `run-migrations.js` (Recommended)
Main migration runner that works with Supabase.

**Usage:**
```bash
npm run migrate
```

**What it does:**
- Reads all migration files in order
- Combines them into a single SQL file
- Displays the SQL for you to copy into Supabase SQL Editor
- If Supabase CLI is installed, it will try to use that instead

### 2. `run-migrations-psql.js`
Runs migrations directly using `psql` if you have a database connection string.

**Usage:**
```bash
# Set your database URL in .env.local
DATABASE_URL=postgresql://postgres:password@host:port/postgres

# Then run
npm run migrate:psql
```

**Requirements:**
- PostgreSQL client tools (`psql`) installed
- Direct database connection string from Supabase

### 3. `run-migrations-simple.sh`
Simple bash script for displaying SQL.

**Usage:**
```bash
chmod +x scripts/run-migrations-simple.sh
./scripts/run-migrations-simple.sh
```

## Quick Start

### Option 1: Using npm script (Easiest)
```bash
npm run migrate
```
This will display the combined SQL that you can copy and paste into Supabase SQL Editor.

### Option 2: Display SQL directly
```bash
npm run migrate:show
```
This will display the combined migration SQL in your terminal.

### Option 3: Using Supabase CLI (Best for automation)
1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Your project ref is: `nbecbsbuerdtakxkrduw`
   (Saved in `supabase/.project-ref`)

3. Link your project:
   ```bash
   supabase link --project-ref nbecbsbuerdtakxkrduw
   ```
   (You'll be prompted for your database password - find it in Supabase Dashboard > Settings > Database)

4. Run migrations:
   ```bash
   supabase db push
   ```

   See `supabase/FIND_PROJECT_REF.md` for detailed instructions.

## Environment Variables

Make sure you have these in your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Optional: For direct database access
DATABASE_URL=postgresql://postgres:password@host:port/postgres
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Troubleshooting

### "psql command not found"
Install PostgreSQL client tools:
- **macOS**: `brew install postgresql`
- **Ubuntu/Debian**: `sudo apt-get install postgresql-client`
- **Windows**: Install PostgreSQL from postgresql.org

### "Supabase CLI not found"
Install it based on your OS:

**macOS:**
```bash
brew install supabase/tap/supabase
```

**Linux/Windows:**
See: https://github.com/supabase/cli#install-the-cli

**Note:** `npm install -g supabase` is NOT supported. Use the official installation methods above.

### "Missing environment variables"
Make sure your `.env.local` file exists and has the required variables.

## Manual Method (Fallback)

If scripts don't work, you can always:
1. Open `supabase/migrations/run-all-migrations.sql`
2. Copy the entire contents
3. Paste into Supabase SQL Editor
4. Run it

