-- Permitir que administradores excluam movimentações de qualquer usuário
-- Antes: apenas o próprio usuário podia excluir suas movimentações
-- Depois: admin pode excluir de qualquer usuário; vendedor/outros só as suas próprias

-- Remover política antiga restrita ao próprio usuário
DROP POLICY IF EXISTS "Users can delete own estoque_movimentacoes" ON public.estoque_movimentacoes;

-- Nova política: admin pode excluir qualquer; usuário comum só as suas
CREATE POLICY "Admin can delete any estoque_movimentacoes"
  ON public.estoque_movimentacoes
  FOR DELETE
  USING (
    has_role(auth.uid(), 'admin')
    OR auth.uid() = user_id
  );
