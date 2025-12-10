# Database Migrations

This directory contains database migration files that should be run in sequential order.

## Migration Files

1. **001_enable_extensions.sql** - Enables UUID extension
2. **002_create_profiles_table.sql** - Creates profiles table and RLS policies
3. **003_create_profile_functions.sql** - Creates functions and triggers for profile management
4. **004_create_updated_at_function.sql** - Creates reusable updated_at timestamp function
5. **005_create_courses_table.sql** - Creates courses table with RLS policies
6. **006_create_courses_indexes.sql** - Creates indexes for courses table
7. **007_add_role_to_profiles.sql** - Adds role column to profiles table
8. **008_add_lecturer_id_to_courses.sql** - Adds lecturer_id to courses and updates policies
9. **009_run_lecturer_updates.sql** - Updates lecturer-related functions and policies
10. **010_create_storage_buckets.sql** - **CRITICAL**: Creates storage buckets for video uploads (`course-videos` and `course-thumbnails`)
11. **011_create_enrollments_table.sql** - Creates enrollments table for course enrollments
12. **012_add_created_at_index.sql** - Adds index on courses.created_at
13. **013_create_channels_table.sql** - Creates channels table for course communication
14. **014_create_videos_table.sql** - Creates videos table for lecture videos
15. **015_create_video_progress_table.sql** - Creates video_progress table for tracking user progress

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
2. **Tables**: Verify `profiles`, `courses`, `enrollments`, `channels`, `videos`, and `video_progress` tables exist
3. **Storage Buckets**: **CRITICAL** - Verify that `course-videos` and `course-thumbnails` buckets exist (required for video uploads)
4. **Policies**: Check that RLS policies are active
5. **Functions**: Verify `handle_new_user()` and `handle_updated_at()` functions exist
6. **Triggers**: Check that triggers are active

You can verify by running:
```sql
-- Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('profiles', 'courses', 'enrollments', 'channels', 'videos', 'video_progress');

-- Check storage buckets (CRITICAL for video uploads)
SELECT id, name, public FROM storage.buckets WHERE id IN ('course-videos', 'course-thumbnails');

-- Check functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name IN ('handle_new_user', 'handle_updated_at');

-- Check policies
SELECT tablename, policyname FROM pg_policies 
WHERE schemaname = 'public';
```

## Important: Storage Buckets for Video Uploads

**If you're getting an error about storage buckets not existing**, you need to run migration **010_create_storage_buckets.sql**. This migration creates:
- `course-videos` bucket (50MB limit, for video files)
- `course-thumbnails` bucket (5MB limit, for thumbnail images)

### Quick Fix: Run Storage Migration Only

If you only need to create the storage buckets, you can run just migration 010:

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Open `010_create_storage_buckets.sql`
4. Copy the entire contents and paste into SQL Editor
5. Click "Run"

Alternatively, you can run this quick SQL to create the buckets:
```sql
-- Create course-videos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-videos',
  'course-videos',
  true,
  52428800, -- 50MB
  ARRAY['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];

-- Create course-thumbnails bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-thumbnails',
  'course-thumbnails',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;
```

## Rolling Back

If you need to rollback a migration, you can manually drop the created objects. However, be careful with production data!

Example rollback for courses table:
```sql
DROP TABLE IF EXISTS public.courses CASCADE;
```

