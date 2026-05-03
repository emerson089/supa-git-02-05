-- Fix RLS policies to allow vendedor to view loads and register returns

-- 1. TRANSFERENCIAS: Allow SELECT for all authenticated users
--    (loads need to be visible for sellers to register returns)
DROP POLICY IF EXISTS "Users can read own transferencias" ON public.transferencias;

CREATE POLICY "Authenticated users can read transferencias" 
ON public.transferencias 
FOR SELECT 
TO authenticated
USING (true);

-- 2. TRANSFERENCIAS: Allow UPDATE for owner, admin, gerente and vendedor
--    Seller needs to update status to 'concluida' when registering return
DROP POLICY IF EXISTS "Users can update own or admin all transferencias" ON public.transferencias;

CREATE POLICY "Users can update transferencias" 
ON public.transferencias 
FOR UPDATE 
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'vendedor'::app_role)
);

-- 3. TRANSFERENCIA_ITENS: Allow SELECT for all authenticated users
DROP POLICY IF EXISTS "Users can read own transferencia_itens" ON public.transferencia_itens;

CREATE POLICY "Authenticated users can read transferencia_itens" 
ON public.transferencia_itens 
FOR SELECT 
TO authenticated
USING (true);

-- 4. TRANSFERENCIA_ITENS: Allow UPDATE for owner, admin, gerente and vendedor
--    Seller needs to update quantidade_retornada
DROP POLICY IF EXISTS "Users can update own or admin all transferencia_itens" ON public.transferencia_itens;

CREATE POLICY "Users can update transferencia_itens" 
ON public.transferencia_itens 
FOR UPDATE 
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'vendedor'::app_role)
);