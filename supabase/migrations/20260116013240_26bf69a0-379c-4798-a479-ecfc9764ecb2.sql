-- Tabela de locais de estoque
CREATE TABLE public.estoque_locais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('central', 'loja', 'banca')),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.estoque_locais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own locais" ON public.estoque_locais FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own locais" ON public.estoque_locais FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own locais" ON public.estoque_locais FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own locais" ON public.estoque_locais FOR DELETE USING (auth.uid() = user_id);

-- Tabela de estoque por local (com campo de reserva)
CREATE TABLE public.estoque_por_local (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES public.estoque_itens(id) ON DELETE CASCADE,
  local_id UUID NOT NULL REFERENCES public.estoque_locais(id) ON DELETE CASCADE,
  quantidade NUMERIC NOT NULL DEFAULT 0,
  quantidade_reservada NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(item_id, local_id)
);

ALTER TABLE public.estoque_por_local ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own estoque_por_local" ON public.estoque_por_local FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own estoque_por_local" ON public.estoque_por_local FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own estoque_por_local" ON public.estoque_por_local FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own estoque_por_local" ON public.estoque_por_local FOR DELETE USING (auth.uid() = user_id);

-- Tabela de transferências
CREATE TABLE public.transferencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  local_origem_id UUID NOT NULL REFERENCES public.estoque_locais(id),
  local_destino_id UUID NOT NULL REFERENCES public.estoque_locais(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('transferencia', 'carga_feira')),
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'concluida', 'cancelada')),
  data_saida TIMESTAMPTZ DEFAULT now(),
  data_retorno TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transferencias" ON public.transferencias FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transferencias" ON public.transferencias FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transferencias" ON public.transferencias FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transferencias" ON public.transferencias FOR DELETE USING (auth.uid() = user_id);

-- Tabela de itens de transferência
CREATE TABLE public.transferencia_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  transferencia_id UUID NOT NULL REFERENCES public.transferencias(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.estoque_itens(id),
  quantidade_enviada NUMERIC NOT NULL DEFAULT 0,
  quantidade_retornada NUMERIC DEFAULT 0,
  preco_unitario NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.transferencia_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transferencia_itens" ON public.transferencia_itens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transferencia_itens" ON public.transferencia_itens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transferencia_itens" ON public.transferencia_itens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transferencia_itens" ON public.transferencia_itens FOR DELETE USING (auth.uid() = user_id);

-- Migração de dados: Criar locais padrão para cada usuário existente
INSERT INTO public.estoque_locais (user_id, nome, tipo)
SELECT DISTINCT user_id, 'Estoque Central', 'central' FROM public.estoque_itens
ON CONFLICT DO NOTHING;

INSERT INTO public.estoque_locais (user_id, nome, tipo)
SELECT DISTINCT user_id, 'Loja Parque das Feiras', 'loja' FROM public.estoque_itens
ON CONFLICT DO NOTHING;

INSERT INTO public.estoque_locais (user_id, nome, tipo)
SELECT DISTINCT user_id, 'Banca da Feira', 'banca' FROM public.estoque_itens
ON CONFLICT DO NOTHING;

-- Migrar estoque existente para Central (todo estoque atual vai para Central com reserva zerada)
INSERT INTO public.estoque_por_local (user_id, item_id, local_id, quantidade, quantidade_reservada)
SELECT 
  ei.user_id, 
  ei.id, 
  el.id, 
  ei.quantidade,
  0
FROM public.estoque_itens ei
JOIN public.estoque_locais el ON el.user_id = ei.user_id AND el.tipo = 'central'
ON CONFLICT (item_id, local_id) DO NOTHING;