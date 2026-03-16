-- Allow media-only messages (no text content required)
ALTER TABLE messages ALTER COLUMN content DROP NOT NULL;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_content_check;
ALTER TABLE messages ADD CONSTRAINT messages_content_check
  CHECK (content IS NULL OR length(content) <= 4000);
