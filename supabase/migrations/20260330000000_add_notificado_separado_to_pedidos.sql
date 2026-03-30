-- Migração para adicionar controle de notificação de pedido separado
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS notificado_separado BOOLEAN DEFAULT FALSE;
