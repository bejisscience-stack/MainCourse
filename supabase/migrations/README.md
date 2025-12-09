# Database Migrations

This directory contains database migration files that should be run in sequential order.

## Migration Files

1. **001_enable_extensions.sql** - Enables UUID extension
2. **002_create_profiles_table.sql** - Creates profiles table and RLS policies
3. **003_create_profile_functions.sql** - Creates functions and triggers for profile management
4. **004_create_updated_at_function.sql** - Creates reusable updated_at timestamp function
5. **005_create_courses_table.sql** - Creates courses table with RLS policies
6. **006_create_courses_indexes.sql** - Creates indexes for courses table

## How to Run Migrations

### Option 1: Run All Migrations at Once (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Open `run-all-migrations.sql` file
4. Copy the entire contents and paste into SQL Editor
5. Click "Run" to execute all migrations at once

### Option 2: Run Migrations Individually

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Open the first migration file (001_enable_extensions.sql)
4. Copy its contents and run it
5. Repeat for each subsequent migration file in numerical order (002, 003, 004, etc.)

## Migration Order

**Important:** Always run migrations in numerical order (001, 002, 003, etc.) as later migrations may depend on earlier ones.

## Verifying Migrations

After running all migrations, verify:

1. **Extensions**: Check that `uuid-ossp` extension is enabled
2. **Tables**: Verify `profiles` and `courses` tables exist
3. **Policies**: Check that RLS policies are active
4. **Functions**: Verify `handle_new_user()` and `handle_updated_at()` functions exist
5. **Triggers**: Check that triggers are active

You can verify by running:
```sql
-- Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('profiles', 'courses');

-- Check functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name IN ('handle_new_user', 'handle_updated_at');

-- Check policies
SELECT tablename, policyname FROM pg_policies 
WHERE schemaname = 'public';
```

## Rolling Back

If you need to rollback a migration, you can manually drop the created objects. However, be careful with production data!

Example rollback for courses table:
```sql
DROP TABLE IF EXISTS public.courses CASCADE;
```

