-- Fase 1: Migração Aditiva - Integração Produção ↔ Estoque com Custo Médio

-- A) Tabela estoque_itens: adicionar custo médio e quantidade com custo
ALTER TABLE estoque_itens 
ADD COLUMN IF NOT EXISTS custo_medio NUMERIC NULL;

ALTER TABLE estoque_itens 
ADD COLUMN IF NOT EXISTS qtd_com_custo NUMERIC DEFAULT 0;

-- B) Tabela producao: adicionar controle de envio para estoque
ALTER TABLE producao 
ADD COLUMN IF NOT EXISTS posted_to_stock_at TIMESTAMPTZ NULL;

ALTER TABLE producao 
ADD COLUMN IF NOT EXISTS unit_cost NUMERIC NULL;

ALTER TABLE producao 
ADD COLUMN IF NOT EXISTS total_cost NUMERIC NULL;

-- C) Tabela estoque_movimentacoes: adicionar rastreamento de origem e custo
ALTER TABLE estoque_movimentacoes 
ADD COLUMN IF NOT EXISTS source_type TEXT NULL;

ALTER TABLE estoque_movimentacoes 
ADD COLUMN IF NOT EXISTS source_id UUID NULL;

ALTER TABLE estoque_movimentacoes 
ADD COLUMN IF NOT EXISTS custo_aplicado NUMERIC NULL;

-- Comentários para documentação
COMMENT ON COLUMN estoque_itens.custo_medio IS 'Custo médio ponderado do produto. NULL = custo desconhecido (produtos antigos)';
COMMENT ON COLUMN estoque_itens.qtd_com_custo IS 'Quantidade que possui custo conhecido para cálculo do custo médio';
COMMENT ON COLUMN producao.posted_to_stock_at IS 'Data/hora de envio para estoque. NULL = não enviado';
COMMENT ON COLUMN producao.unit_cost IS 'Custo unitário calculado do lote';
COMMENT ON COLUMN producao.total_cost IS 'Custo total do lote';
COMMENT ON COLUMN estoque_movimentacoes.source_type IS 'Tipo de origem: LOT, SALE, ADJUSTMENT';
COMMENT ON COLUMN estoque_movimentacoes.source_id IS 'ID da origem (lote ou pedido)';
COMMENT ON COLUMN estoque_movimentacoes.custo_aplicado IS 'Custo unitário no momento da movimentação (para COGS)';