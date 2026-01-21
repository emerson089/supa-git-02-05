-- Fix: estoque_por_local_read_policy
-- Remove overly permissive policy that allows any authenticated user to read all inventory location data
-- Replace with owner-scoped policy to prevent cross-user data exposure

DROP POLICY IF EXISTS "Authenticated users can read all estoque_por_local" ON public.estoque_por_local;

-- Create owner-scoped policy for SELECT
CREATE POLICY "Users can read own estoque_por_local"
ON public.estoque_por_local
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);