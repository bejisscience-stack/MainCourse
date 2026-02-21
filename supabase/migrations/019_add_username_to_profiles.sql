-- Migration: Add unique username column to profiles table
-- Description: Replaces full_name with username, making it unique and required

-- Step 1: Add username column (nullable initially to allow migration of existing data)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT;

-- Step 2: Migrate existing full_name data to username (if full_name exists, use it; otherwise use email prefix)
UPDATE public.profiles 
SET username = COALESCE(
  NULLIF(TRIM(full_name), ''),
  SPLIT_PART(email, '@', 1)
)
WHERE username IS NULL;

-- Step 3: Make username NOT NULL
ALTER TABLE public.profiles 
ALTER COLUMN username SET NOT NULL;

-- Step 4: Add unique constraint on username
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles(username);

-- Step 5: Update the handle_new_user function to use username instead of full_name
-- Username is required, so throw error if not provided
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_username TEXT;
BEGIN
  -- Get username from metadata (required)
  user_username := NEW.raw_user_meta_data->>'username';
  
  -- Validate username is provided
  IF user_username IS NULL OR TRIM(user_username) = '' THEN
    RAISE EXCEPTION 'Username is required for registration';
  END IF;
  
  -- Trim and validate username format
  user_username := TRIM(user_username);
  
  IF LENGTH(user_username) < 3 OR LENGTH(user_username) > 30 THEN
    RAISE EXCEPTION 'Username must be between 3 and 30 characters';
  END IF;
  
  IF NOT (user_username ~ '^[a-zA-Z0-9_]+$') THEN
    RAISE EXCEPTION 'Username can only contain letters, numbers, and underscores';
  END IF;
  
  -- Check uniqueness
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = user_username) THEN
    RAISE EXCEPTION 'Username already exists. Please choose a different username.';
  END IF;
  
  INSERT INTO public.profiles (id, email, username, role)
  VALUES (
    NEW.id,
    NEW.email,
    user_username,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create a function to check username uniqueness before insert/update
CREATE OR REPLACE FUNCTION public.check_username_unique()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE username = NEW.username 
    AND id != NEW.id
  ) THEN
    RAISE EXCEPTION 'Username already exists. Please choose a different username.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger to enforce username uniqueness
DROP TRIGGER IF EXISTS enforce_username_unique ON public.profiles;
CREATE TRIGGER enforce_username_unique
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_username_unique();

