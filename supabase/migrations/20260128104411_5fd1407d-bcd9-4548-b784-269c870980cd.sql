-- Nova tabela para armazenar curvas percentuais por dia do mês
CREATE TABLE IF NOT EXISTS curvas_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  dia INTEGER NOT NULL CHECK (dia >= 1 AND dia <= 31),
  percentual_esperado NUMERIC NOT NULL,
  anos_considerados INTEGER DEFAULT 1,
  total_faturamento_base NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, mes, dia)
);

-- RLS para curvas_mensais
ALTER TABLE curvas_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own curvas" ON curvas_mensais
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Função RPC: get_media_mes_anos_anteriores
-- Calcula a média do mesmo mês em todos os anos disponíveis
CREATE OR REPLACE FUNCTION get_media_mes_anos_anteriores(
  p_user_id UUID,
  p_mes INTEGER,
  p_limite_anos INTEGER DEFAULT 5
) RETURNS TABLE (
  media_faturamento NUMERIC,
  anos_usados INTEGER[],
  faturamentos_por_ano JSONB
) AS $$
  WITH faturamentos AS (
    SELECT 
      EXTRACT(YEAR FROM created_at)::int as ano,
      SUM(valor_total) as faturamento
    FROM pedidos 
    WHERE user_id = p_user_id
      AND status_pagamento = 'PAGO'
      AND EXTRACT(MONTH FROM created_at) = p_mes
      AND EXTRACT(YEAR FROM created_at) < EXTRACT(YEAR FROM NOW())
    GROUP BY EXTRACT(YEAR FROM created_at)
    ORDER BY ano DESC
    LIMIT p_limite_anos
  )
  SELECT 
    COALESCE(AVG(faturamento), 0)::numeric as media_faturamento,
    COALESCE(ARRAY_AGG(ano ORDER BY ano DESC), ARRAY[]::integer[]) as anos_usados,
    COALESCE(jsonb_object_agg(ano::text, faturamento), '{}'::jsonb) as faturamentos_por_ano
  FROM faturamentos;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

-- Função RPC: get_curva_mes
-- Calcula a curva percentual acumulada de um mês específico baseada em histórico
CREATE OR REPLACE FUNCTION get_curva_mes(
  p_user_id UUID,
  p_mes INTEGER
) RETURNS TABLE (
  dia INTEGER,
  percentual_acumulado NUMERIC,
  faturamento_acumulado NUMERIC
) AS $$
  WITH dados_diarios AS (
    SELECT 
      EXTRACT(DAY FROM created_at)::int as dia,
      SUM(valor_total) as fat_dia
    FROM pedidos 
    WHERE user_id = p_user_id
      AND status_pagamento = 'PAGO'
      AND EXTRACT(MONTH FROM created_at) = p_mes
      AND EXTRACT(YEAR FROM created_at) < EXTRACT(YEAR FROM NOW())
    GROUP BY EXTRACT(DAY FROM created_at)
  ),
  total AS (
    SELECT COALESCE(SUM(fat_dia), 0) as total_mes FROM dados_diarios
  ),
  acumulado AS (
    SELECT 
      d.dia,
      SUM(d.fat_dia) OVER (ORDER BY d.dia) as fat_acumulado,
      t.total_mes
    FROM dados_diarios d, total t
  )
  SELECT 
    a.dia,
    CASE WHEN a.total_mes > 0 
      THEN ROUND((a.fat_acumulado / a.total_mes * 100)::numeric, 2)
      ELSE (a.dia::numeric / 31 * 100)
    END as percentual_acumulado,
    a.fat_acumulado as faturamento_acumulado
  FROM acumulado a
  ORDER BY a.dia;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;