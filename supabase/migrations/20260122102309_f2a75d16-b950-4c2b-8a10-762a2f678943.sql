-- Drop the overly permissive SELECT policy on lotes bucket
DROP POLICY IF EXISTS "Authenticated users can read all lotes images" ON storage.objects;

-- Create a more restrictive policy: users can read their own files OR admin/gerente can read all
CREATE POLICY "Users can read own or role-based lotes images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lotes' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gerente'::app_role)
  )
);