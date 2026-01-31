-- Criar tabela de excursões
CREATE TABLE public.excursoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  taxa NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.excursoes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para excursoes
CREATE POLICY "Users can read own excursoes"
ON public.excursoes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own excursoes"
ON public.excursoes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own excursoes"
ON public.excursoes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own excursoes"
ON public.excursoes FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_excursoes_updated_at
BEFORE UPDATE ON public.excursoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar colunas na tabela pedidos
ALTER TABLE public.pedidos 
  ADD COLUMN excursao_id UUID REFERENCES public.excursoes(id),
  ADD COLUMN taxa_excursao NUMERIC DEFAULT 0;