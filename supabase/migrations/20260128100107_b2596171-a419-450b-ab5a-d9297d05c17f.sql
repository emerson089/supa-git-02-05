-- Tabela para armazenar metas mensais calculadas automaticamente
CREATE TABLE public.metas_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  valor_meta NUMERIC NOT NULL DEFAULT 0,
  media_base NUMERIC NOT NULL DEFAULT 0,
  percentual_crescimento NUMERIC NOT NULL DEFAULT 10,
  faturamento_realizado NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, ano, mes)
);

-- RLS
ALTER TABLE public.metas_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own metas" ON public.metas_mensais 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own metas" ON public.metas_mensais 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own metas" ON public.metas_mensais 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own metas" ON public.metas_mensais 
  FOR DELETE USING (auth.uid() = user_id);

-- Função para calcular faturamento em período usando COALESCE(paid_at, created_at)
CREATE OR REPLACE FUNCTION public.get_faturamento_periodo(
  p_user_id UUID,
  p_inicio TIMESTAMPTZ,
  p_fim TIMESTAMPTZ
) RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(valor_total), 0)
  FROM public.pedidos
  WHERE user_id = p_user_id
    AND status_pagamento = 'PAGO'
    AND COALESCE(paid_at, created_at) >= p_inicio
    AND COALESCE(paid_at, created_at) <= p_fim
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;