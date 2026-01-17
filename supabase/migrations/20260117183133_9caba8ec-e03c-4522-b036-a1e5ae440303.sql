-- Adicionar novos tipos de movimentação para ajustes de estoque local
ALTER TABLE public.estoque_movimentacoes
DROP CONSTRAINT IF EXISTS estoque_movimentacoes_tipo_check;

ALTER TABLE public.estoque_movimentacoes
ADD CONSTRAINT estoque_movimentacoes_tipo_check
CHECK (tipo = ANY (ARRAY[
  'entrada'::text,
  'saida'::text,
  'ENVIO_FEIRA'::text,
  'RETORNO_FEIRA'::text,
  'VENDA_FEIRA'::text,
  'ESTORNO_FEIRA'::text,
  'AJUSTE_ENTRADA'::text,
  'AJUSTE_SAIDA'::text,
  'TRANSFERENCIA'::text
]));