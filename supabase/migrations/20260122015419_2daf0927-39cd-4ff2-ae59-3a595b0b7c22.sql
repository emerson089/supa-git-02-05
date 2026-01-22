-- Fix PUBLIC_DATA_EXPOSURE: Restrict transferencias/transferencia_itens read access to specific roles
-- instead of all authenticated users

-- 1. TRANSFERENCIAS: Restrict SELECT to owner OR specific roles (admin, gerente, vendedor)
DROP POLICY IF EXISTS "Authenticated users can read transferencias" ON public.transferencias;

CREATE POLICY "Users can read own or role-based transferencias" 
ON public.transferencias 
FOR SELECT 
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'vendedor'::app_role)
);

-- 2. TRANSFERENCIA_ITENS: Restrict SELECT to owner OR specific roles
DROP POLICY IF EXISTS "Authenticated users can read transferencia_itens" ON public.transferencia_itens;

CREATE POLICY "Users can read own or role-based transferencia_itens" 
ON public.transferencia_itens 
FOR SELECT 
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'vendedor'::app_role)
);