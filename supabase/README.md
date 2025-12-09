# Database Setup Instructions

## Setting up Supabase Database Schema

Follow these steps to set up your database schema in Supabase:

### 1. Access Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor

### 2. Run Migrations

**Recommended Approach: Use Migrations**

1. Go to the `migrations/` directory
2. Run each migration file in numerical order (001, 002, 003, etc.)
3. Copy the contents of each file and run them sequentially in the SQL Editor

See `migrations/README.md` for detailed migration instructions.

**Alternative: Use Single Schema File**

If you prefer, you can still use the `schema.sql` file which contains all migrations in one file.

### 3. Verify the Setup
After running the migrations, verify that:
- The `profiles` table has been created
- The `courses` table has been created
- Row Level Security (RLS) policies are enabled
- The trigger function `handle_new_user()` is created
- The trigger `on_auth_user_created` is active

### 4. Test the Setup
1. Try signing up a new user through the `/signup` page
2. Check the `auth.users` table - a new user should be created
3. Check the `profiles` table - a corresponding profile should be automatically created
4. Check the `courses` table - you can add courses or run the seed file

## What the Schema Does

- **profiles table**: Stores additional user information (extends Supabase's built-in auth.users)
- **Automatic profile creation**: When a user signs up, a profile is automatically created via trigger
- **Row Level Security**: Users can only view and edit their own profiles
- **Timestamps**: Automatically tracks when profiles are created and updated
- **courses table**: Stores course information including title, type, price, author, creator, ratings, and reviews
- **Public course access**: Anyone can view courses, but only authenticated users can create/update them
- **Course types**: Supports three types: Editing, Content Creation, and Website Creation

## Seeding Sample Courses (Optional)

After setting up the schema, you can optionally seed the database with sample courses:

1. Open the SQL Editor in your Supabase dashboard
2. Copy the contents of `seed-courses.sql`
3. Paste and run it to add 10 sample courses

This will help you test the courses page immediately.

## Environment Variables Required

Make sure you have these environment variables set in your `.env.local` file:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

