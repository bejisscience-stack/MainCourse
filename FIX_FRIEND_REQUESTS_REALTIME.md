# Fix Friend Requests Real-Time Updates

## Problem
Friend requests are not appearing in real-time for the receiver. When User A sends a friend request to User B, User B doesn't see it until they manually refresh.

## Root Causes
1. **Realtime replication not enabled** - The `friend_requests` table needs to be added to Supabase's replication publication
2. **Real-time subscription may not be working** - The subscription setup needed improvement
3. **No fallback mechanism** - If real-time fails, there was no polling backup

## Solutions Implemented

### 1. Enhanced Real-Time Subscription (`hooks/useFriendRequests.ts`)
- ✅ Improved subscription setup with better error handling
- ✅ Added separate handlers for INSERT, UPDATE, and DELETE events
- ✅ Added automatic reconnection on subscription failure
- ✅ Added polling fallback (every 10 seconds) in case real-time fails
- ✅ Better logging for debugging

### 2. Database Migration (`supabase/migrations/047_enable_realtime_for_friend_requests.sql`)
- ✅ Enables replication for `friend_requests` table
- ✅ Enables replication for `friendships` table
- ✅ **CRITICAL:** This must be run for real-time to work!

### 3. Improved Error Handling
- ✅ Better error messages in UI
- ✅ Retry button in error state
- ✅ Enhanced API logging for debugging

## Required Actions

### Step 1: Run the Migration (CRITICAL)
Run this SQL in your Supabase SQL Editor:

```sql
-- Enable replication for friend_requests table
ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;

-- Enable replication for friendships table
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
```

Or run the full migration file:
```bash
# File: supabase/migrations/047_enable_realtime_for_friend_requests.sql
```

### Step 2: Verify Replication is Enabled
Run this query to verify:

```sql
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename IN ('friend_requests', 'friendships');
```

You should see both tables listed.

### Step 3: Test Real-Time Updates
1. Open the app in two different browser windows/tabs
2. Log in as two different users (e.g., testuser and beji)
3. Have testuser send a friend request to beji
4. Beji should see the request appear automatically within 1-2 seconds

## How It Works Now

1. **Real-Time (Primary)**: When a friend request is created/updated/deleted, Supabase Realtime triggers the subscription
2. **Polling (Fallback)**: Every 10 seconds, the hook automatically fetches the latest requests (in case real-time fails)
3. **Manual Refresh**: Users can click the refresh button to manually reload requests

## Debugging

### Check Browser Console
Look for these logs:
- `[RT] Friend request INSERT (received):` - Real-time event received
- `[RT] Friend requests subscription status: SUBSCRIBED` - Subscription active
- `[RT] Successfully subscribed to friend requests changes` - Ready to receive updates

### Check Server Logs
The API logs detailed information:
- `=== FINAL API RESPONSE SUMMARY ===` - Shows what data is being returned
- `Received requests count:` - Number of received requests

### Common Issues

**Issue: Still not seeing requests in real-time**
- ✅ Verify migration 047 has been run
- ✅ Check browser console for subscription errors
- ✅ Verify RLS policies allow viewing friend requests (migration 044)
- ✅ Check that both users are authenticated

**Issue: "Error loading requests"**
- ✅ Check browser console for API errors
- ✅ Verify the user is authenticated
- ✅ Check server logs for RLS policy errors
- ✅ Click "Retry" button to manually refresh

**Issue: Requests appear but usernames are wrong**
- ✅ Run migration 045 (allow profile viewing)
- ✅ Run migration 046 (verify username display)
- ✅ Check that profiles have usernames set

## Testing Checklist

- [ ] Migration 047 has been run
- [ ] Replication is enabled (verified with SQL query)
- [ ] Real-time subscription shows "SUBSCRIBED" status in console
- [ ] Friend request appears automatically when sent
- [ ] Friend request disappears automatically when accepted/rejected
- [ ] Polling fallback works (check console for periodic fetches)
- [ ] Manual refresh button works
- [ ] Usernames display correctly

## Additional Notes

- The polling interval is set to 10 seconds as a fallback
- Real-time events should appear within 1-2 seconds
- If real-time fails, polling ensures requests appear within 10 seconds maximum
- The subscription automatically reconnects if it fails

