
CREATE TABLE public.catalogo_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cliente_id UUID NOT NULL,
  catalogo_id UUID NOT NULL,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.catalogo_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own catalogo_envios" ON public.catalogo_envios
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_catalogo_envios_lookup 
  ON public.catalogo_envios (user_id, catalogo_id, cliente_id);
