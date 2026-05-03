-- Fix: estoque_locais_broad_read
-- Remove overly permissive policy that allows any authenticated user to read all locations
-- Replace with owner-scoped policy

DROP POLICY IF EXISTS "Authenticated users can read all estoque_locais" ON public.estoque_locais;

-- Create owner-scoped policy for SELECT
CREATE POLICY "Users can read own estoque_locais"
ON public.estoque_locais
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);