-- Log uploads storage bucket and RLS policies
-- Run in Supabase SQL Editor or via: supabase db push

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'log-uploads',
  'log-uploads',
  false,
  52428800,
  ARRAY['text/csv', 'text/plain', 'application/json', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "log_uploads_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "log_uploads_select_own" ON storage.objects;
DROP POLICY IF EXISTS "log_uploads_delete_own" ON storage.objects;

-- Authenticated users: upload only into their own folder ({user_id}/...)
CREATE POLICY "log_uploads_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'log-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Read / list own files
CREATE POLICY "log_uploads_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'log-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Delete own files
CREATE POLICY "log_uploads_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'log-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
