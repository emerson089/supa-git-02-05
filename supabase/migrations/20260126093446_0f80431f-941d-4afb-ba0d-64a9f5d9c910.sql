-- Add "Deny anonymous access" policy to pedidos table for defense-in-depth
-- This ensures that even if authentication fails, anonymous users cannot query the table

CREATE POLICY "Deny anonymous access to pedidos"
ON public.pedidos
FOR ALL
TO anon
USING (false);