-- Backfill reverse friendship rows for legacy one-direction data.
-- Idempotent and non-destructive.
INSERT INTO friendships (user_id, friend_id, created_at)
SELECT
  f.friend_id AS user_id,
  f.user_id AS friend_id,
  f.created_at
FROM friendships f
WHERE f.user_id <> f.friend_id
ON CONFLICT (user_id, friend_id) DO NOTHING;
