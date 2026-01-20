-- Fix overly permissive UPDATE policies on transferencias and transferencia_itens
-- These currently allow any authenticated user to update any record

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can update transferencias" ON public.transferencias;
DROP POLICY IF EXISTS "Authenticated users can update transferencia_itens" ON public.transferencia_itens;
DROP POLICY IF EXISTS "Authenticated users can update estoque_por_local" ON public.estoque_por_local;

-- Create properly scoped UPDATE policies for transferencias
-- Allow users to update their own transfers OR admins can update all
CREATE POLICY "Users can update own or admin all transferencias"
  ON public.transferencias
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Create properly scoped UPDATE policies for transferencia_itens
-- Allow users to update their own transfer items OR admins can update all
CREATE POLICY "Users can update own or admin all transferencia_itens"
  ON public.transferencia_itens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Create properly scoped UPDATE policies for estoque_por_local
-- Allow users to update their own stock records OR admins can update all
CREATE POLICY "Users can update own or admin all estoque_por_local"
  ON public.estoque_por_local
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));