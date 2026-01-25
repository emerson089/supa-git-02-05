-- =====================================================
-- MIGRAÇÃO: Liberar Transferências, Ajuste e Preços para VENDEDOR
-- =====================================================

-- 1. Policy: estoque_locais - SELECT para Vendedor
CREATE POLICY "vendedor can read estoque_locais"
ON public.estoque_locais
FOR SELECT
USING (has_role(auth.uid(), 'vendedor'::app_role));

-- 2. Policy: estoque_por_local - UPDATE para Vendedor (ajustes de estoque)
DROP POLICY IF EXISTS "Users can update own or admin all estoque_por_local" ON public.estoque_por_local;

CREATE POLICY "Users can update own or role-based estoque_por_local"
ON public.estoque_por_local
FOR UPDATE
USING (
  (auth.uid() = user_id) 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'vendedor'::app_role)
);

-- 3. Policy: estoque_movimentacoes - SELECT para Vendedor
CREATE POLICY "vendedor can read estoque_movimentacoes"
ON public.estoque_movimentacoes
FOR SELECT
USING (has_role(auth.uid(), 'vendedor'::app_role));

-- 4. Policy: estoque_movimentacoes - INSERT para Vendedor (registrar ajustes)
CREATE POLICY "vendedor can insert estoque_movimentacoes"
ON public.estoque_movimentacoes
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'vendedor'::app_role));

-- 5. Policy: precos_por_local - SELECT para Vendedor
CREATE POLICY "vendedor can read precos_por_local"
ON public.precos_por_local
FOR SELECT
USING (has_role(auth.uid(), 'vendedor'::app_role));

-- 6. Policy: precos_por_local - INSERT para Vendedor
CREATE POLICY "vendedor can insert precos_por_local"
ON public.precos_por_local
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'vendedor'::app_role));

-- 7. Policy: precos_por_local - UPDATE para Vendedor
CREATE POLICY "vendedor can update precos_por_local"
ON public.precos_por_local
FOR UPDATE
USING (has_role(auth.uid(), 'vendedor'::app_role));

-- 8. Policy: precos_por_local - DELETE para Vendedor (para usar preço base)
CREATE POLICY "vendedor can delete precos_por_local"
ON public.precos_por_local
FOR DELETE
USING (has_role(auth.uid(), 'vendedor'::app_role));

-- 9. Policy: transferencias - INSERT para Vendedor (criar transferências)
CREATE POLICY "vendedor can insert transferencias"
ON public.transferencias
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'vendedor'::app_role));

-- 10. Policy: transferencia_itens - INSERT para Vendedor
CREATE POLICY "vendedor can insert transferencia_itens"
ON public.transferencia_itens
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'vendedor'::app_role));