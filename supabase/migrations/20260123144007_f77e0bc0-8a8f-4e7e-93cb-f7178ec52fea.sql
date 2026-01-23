-- Criar tabela de preços por local
CREATE TABLE public.precos_por_local (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  item_id UUID NOT NULL,
  local_id UUID NOT NULL,
  preco_venda NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT precos_por_local_unique UNIQUE(item_id, local_id, user_id)
);

-- Habilitar RLS
ALTER TABLE public.precos_por_local ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (owner-scoped)
CREATE POLICY "Users can read own precos_por_local"
ON public.precos_por_local FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own precos_por_local"
ON public.precos_por_local FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own precos_por_local"
ON public.precos_por_local FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own precos_por_local"
ON public.precos_por_local FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_precos_por_local_updated_at
BEFORE UPDATE ON public.precos_por_local
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();