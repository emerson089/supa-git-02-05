-- Permitir que todos os usuários autenticados visualizem e atualizem transferências (cargas)
-- Isso permite que vendedores vejam cargas criadas pelo admin e registrem retornos

-- TRANSFERENCIAS - Atualizar políticas de SELECT e UPDATE
DROP POLICY IF EXISTS "Users can read own transferencias" ON public.transferencias;
DROP POLICY IF EXISTS "Users can update own transferencias" ON public.transferencias;

CREATE POLICY "Authenticated users can read all transferencias" 
  ON public.transferencias FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can update transferencias" 
  ON public.transferencias FOR UPDATE 
  TO authenticated 
  USING (true);

-- TRANSFERENCIA_ITENS - Atualizar políticas de SELECT e UPDATE
DROP POLICY IF EXISTS "Users can read own transferencia_itens" ON public.transferencia_itens;
DROP POLICY IF EXISTS "Users can update own transferencia_itens" ON public.transferencia_itens;

CREATE POLICY "Authenticated users can read all transferencia_itens" 
  ON public.transferencia_itens FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can update transferencia_itens" 
  ON public.transferencia_itens FOR UPDATE 
  TO authenticated 
  USING (true);

-- ESTOQUE_LOCAIS - Permitir leitura para todos autenticados
DROP POLICY IF EXISTS "Users can read own locais" ON public.estoque_locais;

CREATE POLICY "Authenticated users can read all estoque_locais" 
  ON public.estoque_locais FOR SELECT 
  TO authenticated 
  USING (true);

-- ESTOQUE_POR_LOCAL - Permitir leitura e atualização para todos autenticados
DROP POLICY IF EXISTS "Users can read own estoque_por_local" ON public.estoque_por_local;
DROP POLICY IF EXISTS "Users can update own estoque_por_local" ON public.estoque_por_local;

CREATE POLICY "Authenticated users can read all estoque_por_local" 
  ON public.estoque_por_local FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can update estoque_por_local" 
  ON public.estoque_por_local FOR UPDATE 
  TO authenticated 
  USING (true);

-- ESTOQUE_MOVIMENTACOES - Permitir inserção para todos autenticados (registrar movimentações no retorno)
DROP POLICY IF EXISTS "Users can insert own estoque_movimentacoes" ON public.estoque_movimentacoes;

CREATE POLICY "Authenticated users can insert estoque_movimentacoes" 
  ON public.estoque_movimentacoes FOR INSERT 
  TO authenticated 
  WITH CHECK (true);