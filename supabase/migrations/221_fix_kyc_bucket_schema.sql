-- Migration 221: Fix kyc-documents bucket DatabaseInvalidObjectDefinition
--
-- Storage uploads to the kyc-documents bucket return:
--   { "statusCode": "503", "error": "DatabaseInvalidObjectDefinition",
--     "message": "The database schema is invalid or incompatible." }
--
-- The schema itself is correct (bucket present, storage.objects has all
-- expected columns, the 3 RLS policies from migration 215 are well-formed).
-- The most likely cause is a stale PostgREST/storage-api schema cache and/or
-- policies registered before a storage-api version bump.
--
-- This migration is non-destructive. It does NOT delete the bucket row or
-- any objects; it only refreshes the bucket settings, recreates the policies,
-- and asks PostgREST to reload its schema cache.
--
-- If after applying this migration uploads still fail with the same error,
-- the next step is to restart the Storage service from the Supabase Dashboard
-- (Project Settings > Infrastructure / API > Restart). No further SQL needed.

-- ============================================
-- PART 1: Refresh bucket row (forces a write to invalidate caches keyed off updated_at)
-- ============================================

UPDATE storage.buckets
SET
  public             = false,
  file_size_limit    = 8388608,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'],
  updated_at         = NOW()
WHERE id = 'kyc-documents';

-- ============================================
-- PART 2: Recreate the 3 RLS policies on storage.objects
-- ============================================
-- Mirrors migration 215 lines 21-51 exactly. Drop+recreate is defensive in
-- case storage-api version changes shifted policy semantics.

DROP POLICY IF EXISTS "kyc_documents_insert_own"   ON storage.objects;
DROP POLICY IF EXISTS "kyc_documents_select_own"   ON storage.objects;
DROP POLICY IF EXISTS "kyc_documents_select_admin" ON storage.objects;

CREATE POLICY "kyc_documents_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "kyc_documents_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "kyc_documents_select_admin"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- PART 3: Reload PostgREST schema cache
-- ============================================
-- Tells PostgREST to reload its schema cache. Storage-api has a separate
-- cache that this does not flush; if uploads still fail after this migration,
-- restart the Storage service from the Dashboard.

NOTIFY pgrst, 'reload schema';
