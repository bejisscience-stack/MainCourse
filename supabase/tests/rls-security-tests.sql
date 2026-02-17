-- =============================================================================
-- RLS Security Tests for friend_requests, friendships, dm_conversations, dm_messages
-- =============================================================================
-- These tests simulate queries as different user roles to verify RLS policies.
-- Run against a test database with the following test users:
--   user_a (UUID: replace with actual test UUID)
--   user_b (UUID: replace with actual test UUID)
--   user_c (UUID: replace with actual test UUID — NOT friends with user_a)
-- =============================================================================

-- =============================================================================
-- TEST SETUP (run as service_role)
-- =============================================================================

-- Replace these with actual test user UUIDs
-- DO $$ DECLARE
--   user_a UUID := '11111111-1111-1111-1111-111111111111';
--   user_b UUID := '22222222-2222-2222-2222-222222222222';
--   user_c UUID := '33333333-3333-3333-3333-333333333333';
-- BEGIN ... END $$;

-- =============================================================================
-- FRIEND_REQUESTS TESTS
-- =============================================================================

-- TEST 1: User can send friend request (should succeed)
-- As user_a:
--   INSERT INTO friend_requests (sender_id, receiver_id, status)
--   VALUES (user_a, user_b, 'pending');
-- EXPECT: success

-- TEST 2: User CANNOT impersonate another sender (should fail)
-- As user_a:
--   INSERT INTO friend_requests (sender_id, receiver_id, status)
--   VALUES (user_b, user_c, 'pending');
-- EXPECT: RLS violation — auth.uid() != sender_id

-- TEST 3: User CANNOT send request to self (should fail)
-- As user_a:
--   INSERT INTO friend_requests (sender_id, receiver_id, status)
--   VALUES (user_a, user_a, 'pending');
-- EXPECT: RLS violation — auth.uid() != receiver_id check fails

-- TEST 4: User can view requests they sent
-- As user_a:
--   SELECT * FROM friend_requests WHERE sender_id = user_a;
-- EXPECT: returns the pending request to user_b

-- TEST 5: User can view requests they received
-- As user_b:
--   SELECT * FROM friend_requests WHERE receiver_id = user_b;
-- EXPECT: returns the pending request from user_a

-- TEST 6: User CANNOT view others' requests
-- As user_c:
--   SELECT * FROM friend_requests;
-- EXPECT: empty result (user_c has no requests)

-- TEST 7: Receiver can accept request (should succeed)
-- As user_b:
--   UPDATE friend_requests SET status = 'accepted'
--   WHERE sender_id = user_a AND receiver_id = user_b;
-- EXPECT: success, and friendship row created via trigger

-- TEST 8: Sender CANNOT accept their own request (should fail)
-- As user_a:
--   UPDATE friend_requests SET status = 'accepted'
--   WHERE sender_id = user_a AND receiver_id = user_b;
-- EXPECT: 0 rows updated — USING clause blocks since auth.uid() != receiver_id

-- TEST 9: Sender can delete PENDING request (should succeed)
-- First, create a new pending request:
-- As user_a:
--   INSERT INTO friend_requests (sender_id, receiver_id, status)
--   VALUES (user_a, user_c, 'pending');
-- Then:
--   DELETE FROM friend_requests
--   WHERE sender_id = user_a AND receiver_id = user_c AND status = 'pending';
-- EXPECT: success

-- TEST 10: Sender CANNOT delete NON-PENDING request (should fail)
-- As user_a (assuming request to user_b is now 'accepted'):
--   DELETE FROM friend_requests
--   WHERE sender_id = user_a AND receiver_id = user_b;
-- EXPECT: 0 rows deleted — status != 'pending'

-- TEST 11: [FIXED] Receiver CANNOT modify sender_id (restrict_friend_request_update trigger)
-- As user_b:
--   UPDATE friend_requests SET sender_id = user_c
--   WHERE sender_id = user_a AND receiver_id = user_b;
-- EXPECT: EXCEPTION 'Cannot modify sender_id or receiver_id' from restrict_friend_request_update trigger
-- STATUS: FIXED — trigger prevents column tampering on UPDATE

-- TEST 12: [FIXED] Receiver CANNOT update already-rejected request
-- As user_b (after rejecting):
--   UPDATE friend_requests SET status = 'accepted'
--   WHERE sender_id = user_a AND receiver_id = user_b AND status = 'rejected';
-- EXPECT: 0 rows updated — RLS USING clause requires status = 'pending', so rejected rows are invisible
-- STATUS: FIXED — UPDATE policy restricted to pending requests only

-- =============================================================================
-- FRIENDSHIPS TESTS
-- =============================================================================

-- TEST 13: User can view friendships they're in
-- As user_a (after friendship created via accepted request):
--   SELECT * FROM friendships WHERE user1_id = user_a OR user2_id = user_a;
-- EXPECT: returns friendship with user_b

-- TEST 14: User CANNOT view others' friendships
-- As user_c:
--   SELECT * FROM friendships;
-- EXPECT: empty result

-- TEST 15: User CANNOT directly insert friendship (no INSERT policy)
-- As user_a:
--   INSERT INTO friendships (user1_id, user2_id) VALUES (user_a, user_c);
-- EXPECT: RLS violation — no INSERT policy exists

-- TEST 16: User can delete friendship they're part of
-- As user_a:
--   DELETE FROM friendships WHERE user1_id = user_a AND user2_id = user_b;
--   (or the canonical ordering equivalent)
-- EXPECT: success

-- =============================================================================
-- DM_CONVERSATIONS TESTS
-- =============================================================================

-- TEST 17: [FIXED] User CANNOT create conversation with non-friend
-- As user_a (NOT friends with user_c):
--   INSERT INTO dm_conversations (user1_id, user2_id)
--   VALUES (LEAST(user_a, user_c), GREATEST(user_a, user_c));
-- EXPECT: RLS violation — INSERT policy requires EXISTS in friendships table
-- STATUS: FIXED — friendship check added to INSERT WITH CHECK

-- TEST 18: User can create conversation with friend (should succeed)
-- As user_a (friends with user_b):
--   INSERT INTO dm_conversations (user1_id, user2_id)
--   VALUES (LEAST(user_a, user_b), GREATEST(user_a, user_b));
-- EXPECT: success (after friendship check fix is applied)

-- TEST 19: User CANNOT create conversation where they're not a participant
-- As user_c:
--   INSERT INTO dm_conversations (user1_id, user2_id)
--   VALUES (user_a, user_b);
-- EXPECT: RLS violation — auth.uid() not in (user1_id, user2_id)

-- TEST 20: User can view their own conversations
-- As user_a:
--   SELECT * FROM dm_conversations;
-- EXPECT: returns conversation with user_b

-- TEST 21: User CANNOT view others' conversations
-- As user_c:
--   SELECT * FROM dm_conversations;
-- EXPECT: empty result (user_c has no conversations)

-- TEST 22: [FIXED] User CANNOT update dm_conversations (no UPDATE policy exists)
-- As user_a:
--   UPDATE dm_conversations SET user2_id = user_c
--   WHERE user1_id = user_a AND user2_id = user_b;
-- EXPECT: 0 rows updated — no UPDATE policy on dm_conversations, RLS blocks all updates
-- STATUS: FIXED — UPDATE policy removed; last_message_at handled by SECURITY DEFINER trigger

-- =============================================================================
-- DM_MESSAGES TESTS
-- =============================================================================

-- TEST 23: Participant can send message (should succeed)
-- As user_a (participant in conversation with user_b):
--   INSERT INTO dm_messages (conversation_id, user_id, content)
--   VALUES (conv_id, user_a, 'Hello!');
-- EXPECT: success

-- TEST 24: User CANNOT impersonate message author
-- As user_a:
--   INSERT INTO dm_messages (conversation_id, user_id, content)
--   VALUES (conv_id, user_b, 'Fake message from B');
-- EXPECT: RLS violation — auth.uid() != user_id

-- TEST 25: Non-participant CANNOT send message to conversation
-- As user_c:
--   INSERT INTO dm_messages (conversation_id, user_id, content)
--   VALUES (conv_id, user_c, 'Intruder message');
-- EXPECT: RLS violation — user_c not in conversation

-- TEST 26: Participant can view messages in their conversation
-- As user_b:
--   SELECT * FROM dm_messages WHERE conversation_id = conv_id;
-- EXPECT: returns all messages in conversation

-- TEST 27: Non-participant CANNOT view messages
-- As user_c:
--   SELECT * FROM dm_messages WHERE conversation_id = conv_id;
-- EXPECT: empty result

-- TEST 28: Author can edit their own message
-- As user_a:
--   UPDATE dm_messages SET content = 'Updated message', edited_at = NOW()
--   WHERE id = msg_id AND user_id = user_a;
-- EXPECT: success

-- TEST 29: Non-author CANNOT edit others' messages
-- As user_b:
--   UPDATE dm_messages SET content = 'Hacked'
--   WHERE id = msg_id; -- msg_id belongs to user_a
-- EXPECT: 0 rows updated

-- TEST 30: [FIXED] Author CANNOT change user_id on their messages
-- As user_a:
--   UPDATE dm_messages SET user_id = user_b
--   WHERE id = msg_id AND user_id = user_a;
-- EXPECT: RLS violation — WITH CHECK (auth.uid() = user_id) blocks changing authorship
-- STATUS: FIXED — WITH CHECK clause added to UPDATE policy

-- TEST 31: Author can delete their own message
-- As user_a:
--   DELETE FROM dm_messages WHERE id = msg_id AND user_id = user_a;
-- EXPECT: success

-- TEST 32: Non-author CANNOT delete others' messages
-- As user_b:
--   DELETE FROM dm_messages WHERE id = msg_id; -- user_a's message
-- EXPECT: 0 rows deleted

-- =============================================================================
-- TRIGGER TESTS (run as service_role to verify)
-- =============================================================================

-- TEST 33: Accepting friend request creates friendship via trigger
-- Verify: after UPDATE friend_requests SET status = 'accepted', a row exists in friendships

-- TEST 34: Rejecting friend request deletes friendship via trigger
-- Verify: after UPDATE friend_requests SET status = 'rejected' (from accepted), friendship row is removed

-- TEST 35: Sending DM updates conversation last_message_at
-- Verify: after INSERT into dm_messages, dm_conversations.last_message_at matches message created_at

-- =============================================================================
-- REALTIME SCOPING (manual verification)
-- =============================================================================

-- TEST 36: User only receives realtime events for rows they can SELECT
-- Subscribe to friend_requests as user_c → should NOT receive events for user_a↔user_b requests
-- Subscribe to dm_messages as user_c → should NOT receive events for user_a↔user_b conversation
-- NOTE: Requires Supabase realtime RLS to be enabled (verify in project settings)

-- =============================================================================
-- NEW TRIGGER & CONSTRAINT TESTS (added per review feedback)
-- =============================================================================

-- TEST 37: prevent_reverse_friend_request trigger blocks reverse-direction duplicates
-- Setup: user_a→user_b pending request exists
-- As user_b:
--   INSERT INTO friend_requests (sender_id, receiver_id, status)
--   VALUES (user_b, user_a, 'pending');
-- EXPECT: EXCEPTION 'A friend request already exists between these users'
-- Verifies: prevent_reverse_friend_request BEFORE INSERT trigger

-- TEST 38: dm_messages content length constraints
-- As user_a (participant in conversation):
--   INSERT INTO dm_messages (conversation_id, user_id, content)
--   VALUES (conv_id, user_a, '');
-- EXPECT: CHECK constraint violation — char_length(content) >= 1
--
--   INSERT INTO dm_messages (conversation_id, user_id, content)
--   VALUES (conv_id, user_a, repeat('x', 4001));
-- EXPECT: CHECK constraint violation — char_length(content) <= 4000
--
--   INSERT INTO dm_messages (conversation_id, user_id, content)
--   VALUES (conv_id, user_a, 'Valid message');
-- EXPECT: success

-- TEST 39: Canonical ordering CHECK(user1_id < user2_id) on friendships and dm_conversations
-- As service_role (bypassing RLS):
--   INSERT INTO friendships (user1_id, user2_id)
--   VALUES (GREATEST(user_a, user_b), LEAST(user_a, user_b));
-- EXPECT: CHECK constraint violation — user1_id must be < user2_id
--
--   INSERT INTO dm_conversations (user1_id, user2_id)
--   VALUES (GREATEST(user_a, user_b), LEAST(user_a, user_b));
-- EXPECT: CHECK constraint violation — user1_id must be < user2_id
-- Verifies: both tables enforce canonical pair ordering at the constraint level

-- TEST 40: restrict_friend_request_update trigger blocks invalid status transitions
-- Setup: user_a→user_b pending request exists
-- As user_b:
--   UPDATE friend_requests SET status = 'pending'
--   WHERE sender_id = user_a AND receiver_id = user_b;
-- EXPECT: EXCEPTION 'Status can only be changed to accepted or rejected'
--
-- As user_b:
--   UPDATE friend_requests SET status = 'accepted'
--   WHERE sender_id = user_a AND receiver_id = user_b;
-- EXPECT: success — pending→accepted is a valid transition
--
-- As user_b (try to change receiver_id):
--   UPDATE friend_requests SET receiver_id = user_c
--   WHERE sender_id = user_a AND receiver_id = user_b;
-- EXPECT: EXCEPTION 'Cannot modify sender_id or receiver_id'
-- Verifies: restrict_friend_request_update validates both column immutability and status values
