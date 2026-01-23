-- Tabela principal de contagens de estoque (snapshots)
CREATE TABLE public.contagens_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  local_id UUID NOT NULL,
  data_contagem TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_pecas INTEGER NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de itens de cada contagem
CREATE TABLE public.contagem_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contagem_id UUID NOT NULL REFERENCES public.contagens_estoque(id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  quantidade_contada INTEGER NOT NULL DEFAULT 0,
  quantidade_sistema INTEGER NOT NULL DEFAULT 0,
  preco_aplicado NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar campo preco_aplicado em estoque_movimentacoes para histórico de preços
ALTER TABLE public.estoque_movimentacoes 
ADD COLUMN preco_aplicado NUMERIC DEFAULT NULL;

-- Enable RLS
ALTER TABLE public.contagens_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contagem_itens ENABLE ROW LEVEL SECURITY;

-- RLS Policies para contagens_estoque
CREATE POLICY "Users can read own contagens_estoque"
ON public.contagens_estoque FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contagens_estoque"
ON public.contagens_estoque FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contagens_estoque"
ON public.contagens_estoque FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contagens_estoque"
ON public.contagens_estoque FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies para contagem_itens
CREATE POLICY "Users can read own contagem_itens"
ON public.contagem_itens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contagem_itens"
ON public.contagem_itens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contagem_itens"
ON public.contagem_itens FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contagem_itens"
ON public.contagem_itens FOR DELETE
USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX idx_contagens_estoque_local_id ON public.contagens_estoque(local_id);
CREATE INDEX idx_contagens_estoque_data ON public.contagens_estoque(data_contagem DESC);
CREATE INDEX idx_contagem_itens_contagem_id ON public.contagem_itens(contagem_id);
CREATE INDEX idx_estoque_movimentacoes_preco ON public.estoque_movimentacoes(preco_aplicado) WHERE preco_aplicado IS NOT NULL;