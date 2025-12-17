# Friend Requests Troubleshooting Guide

## Issues Fixed

### 1. Username Display Issue ("Unknown User" or "User")
**Problem:** Friend requests showing "Unknown User", "User", or truncated usernames instead of real usernames.

**Root Causes:**
- RLS policy blocking profile access (migration 045 not run)
- Profile fetch failing silently
- Username field might be null or empty in database

**Solutions Implemented:**
- Split friend request queries into separate sent/received queries (better RLS compatibility)
- Added individual profile fetch fallback if batch fails
- Enhanced error logging to identify issues
- Added fallback to use email prefix if username is missing or is 'User'
- Improved username display logic in all components
- Added title attributes for full username visibility on hover

**To Fix:**
1. **CRITICAL:** Run migration `045_allow_profile_viewing_for_friends.sql` in Supabase SQL Editor
2. If still having issues, also run `046_verify_username_display.sql` to verify and fix data
3. Check browser console for profile fetch errors
4. Verify usernames exist in profiles table: `SELECT id, username, email FROM profiles;`

### 2. Friend Requests Not Being Received
**Problem:** When User A sends a request to User B, User B doesn't see it.

**Root Causes:**
- Real-time subscriptions not working
- Query using `.or()` might not work correctly with RLS
- Friend request not being created in database

**Solutions Implemented:**
- Split queries into separate sent/received queries (more reliable with RLS)
- Fixed real-time subscription cleanup
- Added better logging for subscription status
- Added manual refresh button

**To Fix:**
1. Check browser console for subscription status logs
2. Verify friend request was created: `SELECT * FROM friend_requests WHERE status = 'pending';`
3. Check RLS policies allow viewing: Run migration 044
4. Use refresh button to manually reload requests

## Database Migrations Required

### Migration 044: Create Friends Tables
```sql
-- Run: supabase/migrations/044_create_friends_tables.sql
```
Creates `friend_requests` and `friendships` tables with RLS policies.

### Migration 045: Allow Profile Viewing
```sql
-- Run: supabase/migrations/045_allow_profile_viewing_for_friends.sql
```
**CRITICAL:** This allows users to view profiles for friend requests. Without this, usernames will show as "User" or fail to load.

### Migration 046: Verify Username Display (NEW)
```sql
-- Run: supabase/migrations/046_verify_username_display.sql
```
Run this if you're still having username display issues. It:
- Ensures the correct RLS policy exists
- Updates any profiles with missing usernames (uses email prefix as fallback)
- Provides diagnostic information

## Debugging Steps

1. **Check if migrations are run:**
   ```sql
   -- Check if tables exist
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('friend_requests', 'friendships');
   
   -- Check if RLS policy exists
   SELECT * FROM pg_policies 
   WHERE tablename = 'profiles' 
   AND policyname = 'Users can view all profiles for friends';
   ```

2. **Check friend requests in database:**
   ```sql
   SELECT * FROM friend_requests 
   WHERE status = 'pending' 
   ORDER BY created_at DESC;
   ```

3. **Check profiles:**
   ```sql
   SELECT id, username, email FROM profiles 
   WHERE id IN (SELECT sender_id FROM friend_requests WHERE status = 'pending')
   OR id IN (SELECT receiver_id FROM friend_requests WHERE status = 'pending');
   ```

4. **Check browser console:**
   - Look for "Friend requests fetched" logs
   - Check for profile fetch errors
   - Verify subscription status

## Common Issues

### Issue: Still seeing "Unknown User"
**Solution:**
1. Run migration 045
2. Refresh the page
3. Check browser console for errors
4. Verify username exists in profiles table

### Issue: Friend requests not appearing
**Solution:**
1. Check if request was created in database
2. Verify RLS policies are correct
3. Check browser console for subscription errors
4. Click refresh button
5. Verify both users are authenticated

### Issue: Accept/Reject buttons not working
**Solution:**
1. Check browser console for API errors
2. Verify user has permission to update friend requests
3. Check if request status is 'pending'

## Testing Checklist

- [ ] Migration 044 is run
- [ ] Migration 045 is run
- [ ] Friend request is created in database
- [ ] Profile exists for sender/receiver
- [ ] Username is populated in profiles table
- [ ] Real-time subscription is active (check console)
- [ ] Refresh button works
- [ ] Accept/Reject buttons work
- [ ] Usernames display correctly

