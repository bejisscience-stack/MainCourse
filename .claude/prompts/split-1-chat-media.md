# Split 1: Allow Media-Only Messages in Chat

## Goal

Users currently cannot send images/videos without text in chat channels. The error "Message content is required" appears when trying to send media without text. Fix this so users can send media-only messages.

## Root Cause

- `messages` table has `content TEXT NOT NULL` with `CHECK (length(content) >= 1 AND length(content) <= 4000)`
- `supabase/functions/chat-messages/index.ts` validates content as required
- `components/chat/MessageInput.tsx` may block send when text is empty even if attachments exist

## Files to Modify

### 1. New Migration: `supabase/migrations/141_allow_media_only_messages.sql`

```sql
-- Allow messages with no text content when attachments are present
ALTER TABLE messages ALTER COLUMN content DROP NOT NULL;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_content_check;
ALTER TABLE messages ADD CONSTRAINT messages_content_check
  CHECK (content IS NULL OR length(content) <= 4000);
```

### 2. `supabase/functions/chat-messages/index.ts`

- In the POST handler, change content validation:
  - Content should be optional when `attachments` array is provided and non-empty
  - If no content AND no attachments → return 400 error
  - If content provided, keep the 4000 char max validation
  - Keep the rest of the logic (channel access, mute check, etc.) unchanged

### 3. `components/chat/MessageInput.tsx`

- The send button should be enabled when EITHER text content OR attachments are present
- When sending with only attachments (no text), pass `content: null` or omit content
- Keep all existing media upload functionality (drag-drop, progress, previews)
- The send flow should work: upload attachments first, then send message with attachment metadata

### 4. `components/chat/Message.tsx`

- Handle messages where `content` is null/empty:
  - If message has attachments but no text, render only the media (images/videos)
  - Don't show an empty text bubble
  - Keep all existing functionality (reactions, replies, lecturer styling, etc.)

## DO NOT Touch

- `components/chat/ChatArea.tsx` (Agent 4 territory)
- `lib/keepz.ts` or any payment files (Agent 2)
- `components/VideoPlayer.tsx` (Agent 3)
- Any admin/withdrawal/balance files (Agent 5)

## Validation

1. Run `npm run build` — must pass with zero errors
2. Verify the migration SQL is syntactically correct
3. Commit with message: "feat: allow media-only messages in chat channels"
4. Output DONE when build passes.
