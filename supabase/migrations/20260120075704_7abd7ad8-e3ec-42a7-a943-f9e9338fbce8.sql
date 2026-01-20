-- Fix overly permissive INSERT policy on estoque_movimentacoes
-- Currently allows any authenticated user to insert records without ownership check

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can insert estoque_movimentacoes" ON public.estoque_movimentacoes;

-- Create properly scoped INSERT policy
-- Users can only insert records where they are the owner
CREATE POLICY "Users can insert own estoque_movimentacoes"
  ON public.estoque_movimentacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);