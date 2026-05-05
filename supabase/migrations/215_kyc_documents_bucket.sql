-- Migration 215: kyc-documents storage bucket (private)
--
-- Stores user-uploaded ID documents and selfies.
-- Path scheme: {user_id}/{submission_id}/{front|back|selfie}.jpg
-- Private bucket — files only readable by the owner and admins.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,                                              -- private
  8388608,                                            -- 8 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop any pre-existing policies on this bucket (idempotent re-run safety)
DROP POLICY IF EXISTS "kyc_documents_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "kyc_documents_select_own" ON storage.objects;
DROP POLICY IF EXISTS "kyc_documents_select_admin" ON storage.objects;

-- Authenticated users can upload to their own folder: kyc-documents/{user_id}/...
CREATE POLICY "kyc_documents_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can read back their own uploads (for previews / status checks)
CREATE POLICY "kyc_documents_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can read every document for review (signed URLs are still required at the
-- application layer — see app/api/admin/kyc/[submissionId]/signed-urls/route.ts)
CREATE POLICY "kyc_documents_select_admin"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- No DELETE / UPDATE policies — submissions are immutable once written.
-- Cleanup happens via auth.users CASCADE on account deletion.
