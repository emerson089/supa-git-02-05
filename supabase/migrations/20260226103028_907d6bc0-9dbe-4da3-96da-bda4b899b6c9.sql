CREATE POLICY "admin can read own locations movimentacoes"
  ON public.estoque_movimentacoes
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND local_id IN (
      SELECT id FROM public.estoque_locais
      WHERE user_id = auth.uid()
    )
  );