-- Migração para adicionar controle de notificação de pedido no carro
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS notificado_no_carro BOOLEAN DEFAULT FALSE;
