-- Sincronizar estoque_por_local do Central com estoque_itens.quantidade
-- Isso corrige a dessincronização existente

-- 1. Atualizar registros existentes no Central
UPDATE estoque_por_local epl
SET quantidade = ei.quantidade,
    updated_at = NOW()
FROM estoque_itens ei
JOIN estoque_locais el ON el.user_id = ei.user_id AND el.tipo = 'central'
WHERE epl.item_id = ei.id
  AND epl.local_id = el.id;

-- 2. Inserir registros faltantes para itens que existem em estoque_itens mas não no Central
INSERT INTO estoque_por_local (user_id, item_id, local_id, quantidade, quantidade_reservada)
SELECT 
  ei.user_id,
  ei.id as item_id,
  el.id as local_id,
  ei.quantidade,
  0 as quantidade_reservada
FROM estoque_itens ei
JOIN estoque_locais el ON el.user_id = ei.user_id AND el.tipo = 'central'
WHERE NOT EXISTS (
  SELECT 1 FROM estoque_por_local epl 
  WHERE epl.item_id = ei.id AND epl.local_id = el.id
);