-- Fix 1: Restrict estoque_itens read access to user's own records
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read all estoque_itens" ON public.estoque_itens;

-- Create a proper owner-scoped SELECT policy
CREATE POLICY "Users can read own estoque_itens"
ON public.estoque_itens
FOR SELECT
USING (auth.uid() = user_id);

-- Fix 2: Add missing storage policies for 'lotes' bucket
-- Allow users to upload only to their own folder
CREATE POLICY "Users can upload to own folder in lotes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lotes' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update only their own files
CREATE POLICY "Users can update own files in lotes"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lotes' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete only their own files
CREATE POLICY "Users can delete own files in lotes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'lotes' AND
  (storage.foldername(name))[1] = auth.uid()::text
);