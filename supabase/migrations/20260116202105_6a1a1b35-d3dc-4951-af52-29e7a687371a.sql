-- Adicionar novos campos para auditoria de feira
ALTER TABLE estoque_movimentacoes ADD COLUMN IF NOT EXISTS transferencia_id uuid REFERENCES transferencias(id);
ALTER TABLE estoque_movimentacoes ADD COLUMN IF NOT EXISTS estoque_antes numeric DEFAULT 0;
ALTER TABLE estoque_movimentacoes ADD COLUMN IF NOT EXISTS estoque_depois numeric DEFAULT 0;
ALTER TABLE estoque_movimentacoes ADD COLUMN IF NOT EXISTS local_id uuid REFERENCES estoque_locais(id);