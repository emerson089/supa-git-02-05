-- Remover política de leitura restritiva de estoque_itens
DROP POLICY IF EXISTS "Users can read own estoque_itens" ON public.estoque_itens;

-- Criar nova política de leitura compartilhada para usuários autenticados
CREATE POLICY "Authenticated users can read all estoque_itens"
ON public.estoque_itens FOR SELECT
TO authenticated
USING (true);