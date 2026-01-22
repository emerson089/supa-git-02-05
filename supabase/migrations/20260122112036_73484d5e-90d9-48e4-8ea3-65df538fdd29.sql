-- Drop the current restrictive SELECT policy on lotes bucket
DROP POLICY IF EXISTS "Users can read own or role-based lotes images" ON storage.objects;

-- Create updated policy: all authenticated users with any role can read lotes images
-- This is needed because sellers (vendedor) need to see product images in the feira module
CREATE POLICY "Users can read role-based lotes images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lotes' AND
  (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gerente'::app_role)
    OR has_role(auth.uid(), 'vendedor'::app_role)
  )
);