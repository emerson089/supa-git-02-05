-- get_media_mes_anos_anteriores: passa a respeitar excluir_cancelados
CREATE OR REPLACE FUNCTION public.get_media_mes_anos_anteriores(
  p_user_id uuid,
  p_mes integer,
  p_limite_anos integer DEFAULT 5,
  p_excluir_cancelados boolean DEFAULT true
) RETURNS TABLE(media_faturamento numeric, anos_usados integer[], faturamentos_por_ano jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH faturamentos AS (
    SELECT
      EXTRACT(YEAR FROM created_at)::int AS ano,
      SUM(valor_total) AS faturamento
    FROM pedidos
    WHERE user_id = p_user_id
      AND status_pagamento = 'PAGO'
      AND EXTRACT(MONTH FROM created_at) = p_mes
      AND EXTRACT(YEAR FROM created_at) < EXTRACT(YEAR FROM NOW())
      AND (
        p_excluir_cancelados = false
        OR UPPER(COALESCE(status_pedido,'')) NOT IN ('CANCELADO','GOLPE','GOLPE CANCELADO')
      )
    GROUP BY EXTRACT(YEAR FROM created_at)
    ORDER BY ano DESC
    LIMIT p_limite_anos
  )
  SELECT
    COALESCE(AVG(faturamento), 0)::numeric,
    COALESCE(ARRAY_AGG(ano ORDER BY ano DESC), ARRAY[]::integer[]),
    COALESCE(jsonb_object_agg(ano::text, faturamento), '{}'::jsonb)
  FROM faturamentos;
$$;

-- get_curva_mes: idem
CREATE OR REPLACE FUNCTION public.get_curva_mes(
  p_user_id uuid,
  p_mes integer,
  p_excluir_cancelados boolean DEFAULT true
) RETURNS TABLE(dia integer, percentual_acumulado numeric, faturamento_acumulado numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH dados_diarios AS (
    SELECT EXTRACT(DAY FROM created_at)::int AS dia, SUM(valor_total) AS fat_dia
    FROM pedidos
    WHERE user_id = p_user_id
      AND status_pagamento = 'PAGO'
      AND EXTRACT(MONTH FROM created_at) = p_mes
      AND EXTRACT(YEAR FROM created_at) < EXTRACT(YEAR FROM NOW())
      AND (
        p_excluir_cancelados = false
        OR UPPER(COALESCE(status_pedido,'')) NOT IN ('CANCELADO','GOLPE','GOLPE CANCELADO')
      )
    GROUP BY EXTRACT(DAY FROM created_at)
  ),
  total AS (SELECT COALESCE(SUM(fat_dia),0) AS total_mes FROM dados_diarios),
  acumulado AS (
    SELECT d.dia, SUM(d.fat_dia) OVER (ORDER BY d.dia) AS fat_acumulado, t.total_mes
    FROM dados_diarios d, total t
  )
  SELECT
    a.dia,
    CASE WHEN a.total_mes > 0 THEN ROUND((a.fat_acumulado/a.total_mes*100)::numeric, 2)
         ELSE (a.dia::numeric/31*100) END,
    a.fat_acumulado
  FROM acumulado a ORDER BY a.dia;
$$;
