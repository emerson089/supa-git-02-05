-- Atualizar policy SELECT da estoque_itens para permitir leitura por roles operacionais
-- Isso permite que vendedores vejam nomes/imagens de produtos no modal de retorno

DROP POLICY IF EXISTS "Users can read own estoque_itens" ON public.estoque_itens;

CREATE POLICY "Users can read own or role-based estoque_itens" 
ON public.estoque_itens 
FOR SELECT 
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'vendedor'::app_role)
);