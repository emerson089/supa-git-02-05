
-- Fix 2: Replace overly permissive INSERT policy on estoque_movimentacoes
DROP POLICY IF EXISTS "Authenticated users can insert estoque_movimentacoes" ON public.estoque_movimentacoes;

CREATE POLICY "Authenticated users can insert own estoque_movimentacoes"
ON public.estoque_movimentacoes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
