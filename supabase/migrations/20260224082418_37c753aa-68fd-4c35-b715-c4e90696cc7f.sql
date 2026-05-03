CREATE POLICY "vendedor can read tipos_ajuste"
ON public.tipos_ajuste_estoque
FOR SELECT
USING (
  has_role(auth.uid(), 'vendedor'::app_role)
);