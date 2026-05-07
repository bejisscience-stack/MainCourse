-- Migration 245: saved_cards uniqueness — composite (user_id, card_token)
--
-- Closes audit finding A-16 from final_security_guide.md.
--
-- Before: idx_saved_cards_token UNIQUE (card_token). The Keepz callback upsert
-- in app/api/payments/keepz/callback/route.ts uses onConflict: "card_token",
-- so if Keepz ever returns the same cardToken value for two different paying
-- users (e.g. same physical card saved by user A and user B), the upsert
-- silently overwrites user A's saved_cards row with user B's user_id —
-- integrity loss for A's saved-card record.
--
-- The cross-user *charge* path is not exposed because GET /api/payments/saved-cards
-- and the create-order saved-card lookup both filter by user_id (auth.uid()).
-- This migration closes the data-integrity hole.
--
-- Pre-flight check on staging: saved_cards has 0 rows and there are no
-- card_token values appearing for more than one user_id, so the swap is
-- data-safe. CONCURRENTLY is unnecessary (empty table), and a transaction-
-- wrapped DROP+CREATE is the simpler shape.
--
-- App-side companion: route handler upsert switches onConflict from
-- "card_token" to "user_id,card_token" in the same change set.

BEGIN;

DROP INDEX IF EXISTS public.idx_saved_cards_token;

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_cards_user_token
  ON public.saved_cards (user_id, card_token);

COMMIT;
